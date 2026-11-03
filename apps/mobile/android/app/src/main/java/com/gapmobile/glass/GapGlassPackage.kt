package com.gapmobile.glass

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp

internal class GapGlassManager : ViewGroupManager<GapGlassView>() {
  override fun getName() = "GapGlassView"
  override fun createViewInstance(context: ThemedReactContext) = GapGlassView(context)
  override fun needsCustomLayoutForChildren() = false

  @ReactProp(name = "lensRadius", defaultFloat = 28f)
  fun setLensRadius(view: GapGlassView, radius: Float) = view.setLensRadius(radius)

  @ReactProp(name = "lensStrength", defaultFloat = 12f)
  fun setLensStrength(view: GapGlassView, strength: Float) = view.setLensStrength(strength)

  override fun onDropViewInstance(view: GapGlassView) {
    view.dispose()
    super.onDropViewInstance(view)
  }
}

class GapGlassPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(GapGlassManager())
}
