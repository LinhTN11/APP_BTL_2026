package com.gapmobile.glass

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.SystemClock
import android.view.View
import kotlin.math.ceil

/** UI-thread cache: one software raster per root, shared by every lens. */
internal object GlassBackdropCache {
  class Frame(val bitmap: Bitmap, val scaleX: Float, val scaleY: Float) {
    val canvas = Canvas(bitmap)
    var capturedAt = 0L
    var generation = 0L
  }

  private val frames = HashMap<View, Frame>()
  private val users = HashMap<View, Int>()
  var capturing = false
    private set

  fun generation(root: View) = frames[root]?.generation ?: -1L

  fun retain(root: View) {
    users[root] = (users[root] ?: 0) + 1
  }

  fun release(root: View) {
    val remaining = (users[root] ?: 1) - 1
    if (remaining <= 0) {
      users.remove(root)
      // Do not explicitly recycle a bitmap still referenced by a RenderNode.
      frames.remove(root)
    } else users[root] = remaining
  }

  fun acquire(root: View): Frame? {
    if (capturing || root.width <= 0 || root.height <= 0) return frames[root]
    val w = ceil(root.width / 3.0).toInt().coerceAtLeast(1)
    val h = ceil(root.height / 3.0).toInt().coerceAtLeast(1)
    var frame = frames[root]
    if (frame == null || frame.bitmap.width != w || frame.bitmap.height != h) {
      frame = Frame(Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888), root.width.toFloat() / w, root.height.toFloat() / h)
      frames[root] = frame
    }
    val now = SystemClock.uptimeMillis()
    if (frame.generation > 0 && now - frame.capturedAt < 80L) return frame
    frame.bitmap.eraseColor(0)
    val checkpoint = frame.canvas.save()
    frame.canvas.scale(1f / frame.scaleX, 1f / frame.scaleY)
    capturing = true
    try {
      root.draw(frame.canvas)
      frame.capturedAt = now
      frame.generation++
    } catch (_: RuntimeException) {
      // Keep the lens children usable if a platform view cannot draw in software.
    } finally {
      capturing = false
      frame.canvas.restoreToCount(checkpoint)
    }
    return frame.takeIf { it.generation > 0 }
  }
}
