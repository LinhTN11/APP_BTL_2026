package com.gapmobile.glass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.os.Build
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import kotlin.math.min

/** Original whole-pane lens. Only its sampled backdrop is filtered; RN children stay sharp. */
internal class GapGlassView(context: Context) : FrameLayout(context) {
  private var lensRadius = 28f * resources.displayMetrics.density
  private var lensStrength = 12f * resources.displayMetrics.density
  private var source: View? = null
  private var node: RenderNode? = null
  private var shader: RuntimeShader? = null
  private var failed = false
  private var ready = false
  private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val rootPosition = IntArray(2)
  private val lensPosition = IntArray(2)
  private var observer: ViewTreeObserver? = null
  private var generation = -1L
  private var lastX = Int.MIN_VALUE
  private var lastY = Int.MIN_VALUE
  private var dirty = true
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    if (visible()) {
      val root = source
      if (root != null) {
        root.getLocationInWindow(rootPosition)
        getLocationInWindow(lensPosition)
        if (lensPosition[0] - rootPosition[0] != lastX || lensPosition[1] - rootPosition[1] != lastY || GlassBackdropCache.generation(root) != generation || dirty) invalidate()
      }
    }
    true
  }
  private val ticker = object : Runnable {
    override fun run() {
      if (!visible()) return
      source?.let { GlassBackdropCache.acquire(it) }
      invalidate()
      postDelayed(this, 80L)
    }
  }

  init {
    clipChildren = true
    clipToOutline = true
    outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) {
        outline.setRoundRect(0, 0, width, height, min(lensRadius, min(width, height) / 2f))
      }
    }
    ready = true
  }

  fun setLensRadius(dp: Float) {
    lensRadius = dp.coerceAtLeast(0f) * resources.displayMetrics.density
    dirty = true
    invalidateOutline()
    invalidate()
  }

  fun setLensStrength(dp: Float) {
    lensStrength = dp.coerceIn(0f, 24f) * resources.displayMetrics.density
    dirty = true
    invalidate()
  }

  private fun visible() = ready && isAttachedToWindow && isShown && windowVisibility == VISIBLE && Build.VERSION.SDK_INT >= 33

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (Build.VERSION.SDK_INT < 33) return
    var ancestor = parent as? View
    var captureRoot: View? = null
    while (ancestor != null) {
      captureRoot = ancestor
      if (ancestor.javaClass.name.contains("ReactRootView") || ancestor.javaClass.name.contains("ReactSurfaceView")) break
      ancestor = ancestor.parent as? View
    }
    source = captureRoot
    captureRoot?.let { GlassBackdropCache.retain(it) }
    observer = viewTreeObserver.also { it.addOnPreDrawListener(preDraw) }
    restart()
  }

  private fun restart() {
    if (!ready) return
    removeCallbacks(ticker)
    if (visible()) post(ticker)
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    restart()
  }

  override fun onVisibilityChanged(changedView: View, visibility: Int) {
    super.onVisibilityChanged(changedView, visibility)
    restart()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    dirty = true
    invalidateOutline()
  }

  fun dispose() {
    removeCallbacks(ticker)
    observer?.let { if (it.isAlive) it.removeOnPreDrawListener(preDraw) }
    observer = null
    source?.let { GlassBackdropCache.release(it) }
    source = null
    if (Build.VERSION.SDK_INT >= 33) node?.discardDisplayList()
    node = null
    shader = null
    generation = -1L
  }

  override fun onDetachedFromWindow() {
    dispose()
    super.onDetachedFromWindow()
  }

  // Both entry points matter: Android may bypass draw() on an empty ViewGroup.
  override fun draw(canvas: Canvas) {
    if (GlassBackdropCache.capturing) return
    super.draw(canvas)
  }

  override fun dispatchDraw(canvas: Canvas) {
    if (GlassBackdropCache.capturing) return
    if (Build.VERSION.SDK_INT >= 33 && canvas.isHardwareAccelerated && !failed) {
      try {
        drawLens(canvas)
      } catch (error: RuntimeException) {
        failed = true
        Log.w("GapGlass", "Lens unavailable; readable children remain", error)
      }
    }
    super.dispatchDraw(canvas)
  }

  @RequiresApi(33)
  private fun drawLens(canvas: Canvas) {
    if (width <= 0 || height <= 0) return
    val root = source ?: return
    val frame = GlassBackdropCache.acquire(root) ?: return
    val effectNode = node ?: RenderNode("GapWholePaneLens").also { node = it }
    val effect = shader ?: RuntimeShader(LENS_SHADER).also { shader = it; dirty = true }
    root.getLocationInWindow(rootPosition)
    getLocationInWindow(lensPosition)
    val x = lensPosition[0] - rootPosition[0]
    val y = lensPosition[1] - rootPosition[1]
    if (generation != frame.generation || x != lastX || y != lastY || dirty || !effectNode.hasDisplayList()) {
      effectNode.setPosition(0, 0, width, height)
      val recording = effectNode.beginRecording(width, height)
      try {
        recording.scale(frame.scaleX, frame.scaleY)
        recording.drawBitmap(frame.bitmap, -x / frame.scaleX, -y / frame.scaleY, bitmapPaint)
      } finally {
        effectNode.endRecording()
      }
      effect.setFloatUniform("size", width.toFloat(), height.toFloat())
      effect.setFloatUniform("radius", min(lensRadius, min(width, height) / 2f))
      effect.setFloatUniform("strength", lensStrength)
      effect.setFloatUniform("rimBand", 16f * resources.displayMetrics.density)
      effect.setFloatUniform("rimAmount", 40f * resources.displayMetrics.density)
      effectNode.setRenderEffect(RenderEffect.createRuntimeShaderEffect(effect, "backdrop"))
      generation = frame.generation
      lastX = x
      lastY = y
      dirty = false
    }
    canvas.drawRenderNode(effectNode)
  }

  // The 16dp curved rim keeps its own 40dp optical displacement. Interior
  // distortion begins deeper inside, so it cannot cancel the edge curl.
  private companion object {
    const val LENS_SHADER = """
      uniform shader backdrop;
      uniform float2 size;
      uniform float radius;
      uniform float strength;
      uniform float rimBand;
      uniform float rimAmount;
      half4 main(float2 xy) {
        float2 halfSize = size * 0.5;
        float2 p = xy - halfSize;
        float2 q = p / max(halfSize, float2(1.0));
        float2 corner = abs(p) - halfSize + radius;
        float sd = length(max(corner, float2(0.0))) + min(max(corner.x, corner.y), 0.0) - radius;
        float depth = max(0.0, -sd);
        float2 positiveCorner = max(corner, float2(0.0));
        float cornerLength = length(positiveCorner);
        float2 normal = cornerLength > 0.001
          ? (positiveCorner / cornerLength) * sign(p)
          : (corner.x > corner.y ? float2(sign(p.x), 0.0) : float2(0.0, sign(p.y)));
        float rimT = clamp(1.0 - depth / rimBand, 0.0, 1.0);
        float curvature = 1.0 - sqrt(max(0.0, 1.0 - rimT * rimT));
        float2 rim = -normal * curvature * rimAmount;
        float interiorMask = smoothstep(rimBand, rimBand * 1.6, depth);
        float minor = max(1.0, min(halfSize.x, halfSize.y));
        float dome = 1.0 - exp(-depth / (minor * 0.58));
        float2 wave = float2(sin(q.y * 2.7 + q.x * 0.8), sin(q.x * 2.4 - q.y * 0.6));
        float2 inward = -q * dome * strength * 0.7;
        float2 warp = wave * dome * strength * 0.12;
        float2 interior = (inward + warp) * interiorMask;
        float2 bend = rim + interior;
        float2 uv = clamp(xy + bend, float2(1.0), size - 1.0);
        float diagonal = 0.65 + 0.35 * abs(normal.x * normal.y * 2.0);
        float2 chroma = rim * 0.12 * diagonal + interior * 0.025;
        half4 center = backdrop.eval(uv);
        half4 soft = (backdrop.eval(clamp(uv + float2(1.0, 0.0), float2(1.0), size - 1.0)) + backdrop.eval(clamp(uv - float2(1.0, 0.0), float2(1.0), size - 1.0))) * 0.5;
        half3 color = mix(center.rgb, soft.rgb, 0.18);
        color.r = backdrop.eval(clamp(uv + chroma, float2(1.0), size - 1.0)).r;
        color.b = backdrop.eval(clamp(uv - chroma, float2(1.0), size - 1.0)).b;
        float highlight = exp(-depth / 1.7) * (0.07 + 0.10 * max(0.0, -q.y));
        color = color * half(0.985) + half3(highlight);
        return half4(color, center.a);
      }
    """
  }

  // React Native/Yoga lays out the direct children. FrameLayout must not
  // reposition them after Fabric supplies their x/y coordinates.
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {}
}
