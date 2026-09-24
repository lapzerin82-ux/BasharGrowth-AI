package com.bashar.growthchart.chart

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import com.bashar.growthchart.core.chart.Viewport

/**
 * Pinch to zoom, drag to pan, double-tap to reset, tap a red × to inspect it.
 * The chart is re-rendered as vector graphics for every viewport, so it stays sharp.
 */
@Composable
fun InteractiveChart(
    data: ChartData,
    bounds: Viewport,
    viewport: Viewport,
    onViewportChange: (Viewport) -> Unit,
    onPointTapped: (ChartPoint?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current.density
    val renderer = remember(density) { GrowthChartRenderer(density) }
    val currentViewport by rememberUpdatedState(viewport)
    val currentData by rememberUpdatedState(data)
    val onChange by rememberUpdatedState(onViewportChange)
    val onTap by rememberUpdatedState(onPointTapped)
    var size by remember { mutableStateOf(IntSize.Zero) }

    Canvas(
        modifier
            .onSizeChanged { size = it }
            .pointerInput(bounds) {
                detectTransformGestures { centroid, pan, zoom, _ ->
                    val vp = currentViewport
                    val r = renderer.plotRect(size.width.toFloat(), size.height.toFloat())
                    if (r.width() <= 0f || r.height() <= 0f) return@detectTransformGestures
                    var next = vp
                    if (zoom != 1f) {
                        next = next.zoom(zoom.toDouble(), renderer.pxToX(centroid.x, vp, r), renderer.pxToY(centroid.y, vp, r), bounds)
                    }
                    next = next.pan(-pan.x / r.width() * next.width, pan.y / r.height() * next.height, bounds)
                    onChange(next)
                }
            }
            .pointerInput(bounds) {
                detectTapGestures(
                    onTap = { o ->
                        onTap(renderer.hitTest(o.x, o.y, size.width.toFloat(), size.height.toFloat(), currentData, currentViewport))
                    },
                    onDoubleTap = { onChange(bounds) },
                )
            },
    ) {
        drawIntoCanvas { renderer.draw(it.nativeCanvas, this.size.width, this.size.height, data, viewport) }
    }
}
