import React, { Component } from 'react'
import OpenSeaDragon from 'openseadragon'
import OSDConfig from '../osd.config'
import { ReaderContext } from '../context'

import Toolbar from './toolbar'

class CanvasRender extends Component {
  static defaultProps = {
    initialPage: 0,
  }

  static contextType = ReaderContext

  constructor(props) {
    super(props)
    this.viewer = null
  }

  getTargetZoom = (scale = 1) => {
    const { viewport, world } = this.viewer
    const count = world.getItemCount()
    // MAX: Original size (1:1)
    if (count > 1) {
      const tile = world.getItemAt(0)
      return tile.imageToViewportZoom(scale)
    } else if (count && count === 1) {
      return viewport.imageToViewportZoom(scale)
    }
  }

  getMinZoom = () => {
    const { viewport, world } = this.viewer
    const tiledImage = world.getItemAt(0)
    const imageBounds = tiledImage.getBounds()
    const imageAspect = imageBounds.width / imageBounds.height
    const aspectFactor = imageAspect / viewport.getAspectRatio()
    const zoom = (aspectFactor >= 1 ? 1 : aspectFactor) / imageBounds.width
    return zoom
  }

  updateZoomLimits = () => {
    const { viewport, world } = this.viewer
    viewport.maxZoomLevel = this.getTargetZoom()
    viewport.minZoomLevel = this.getMinZoom()
  }

  updateZoom = (scale = 1) => {
    const { viewport } = this.viewer
    let zoom = scale
    // Convert to int
    if (typeof scale === 'string') {
      zoom = parseInt(scale)
      zoom = zoom ? zoom / 100 : null
    }

    if (zoom) {
      zoom = this.getTargetZoom(zoom)
      // Fix max
      if (zoom > viewport.maxZoomLevel) {
        zoom = viewport.maxZoomLevel
      }
      // Fix min
      if (zoom < viewport.minZoomLevel) {
        zoom = viewport.minZoomLevel
      }
      // Zoom
      viewport.zoomTo(zoom, null, true)
    }
  }

  zoomToOriginalSize() {
    const targetZoom = this.getTargetZoom()
    this.viewer.viewport.zoomTo(targetZoom, null, true)
  }

  initOpenSeaDragon() {
    const { id } = this.props
    const { pages } = this.context.state

    // Create viewer
    this.viewer = OpenSeaDragon({ id, tileSources: pages[0], ...OSDConfig })

    // Events hanlder
    this.viewer.addHandler('open', () => {
      this.updateZoomLimits()
      this.renderLayout()
    })

    // Events hanlder
    this.viewer.addHandler('resize', () => {
      this.updateZoomLimits()
    })

    // Events hanlder
    this.viewer.addHandler('zoom', e => {
      const { viewport } = this.viewer

      const currentZoom = parseInt((e.zoom / this.getTargetZoom()) * 100)

      this.context.updateState({ currentZoom })
    })

    this.viewer.addHandler('close', () => {})

    this.viewer.addHandler('open-failed', e => {
      console.error(e)
    })
  }

  renderPage(index) {
    const page = this.context.getPage(index)
    page && this.viewer.open(page)
  }

  renderCover() {
    this.renderPage(0)
  }

  renderLayout() {
    const { viewport, world } = this.viewer
    const { currentPage } = this.context.state
    const pos = new OpenSeaDragon.Point(0, 0)
    const count = world.getItemCount()

    // Cache tile data
    let bounds = null
    let tiledImage = null
    let firstPageBounds = null

    for (let i = 0; i < count; i++) {
      // Get current page
      tiledImage = world.getItemAt(i)

      if (tiledImage) {
        // Get page bounds
        bounds = tiledImage.getBounds()
        // Get first page bounds
        if (i === 0) firstPageBounds = bounds
        // Auto resize pages to fit first page height
        else {
          tiledImage.setHeight(firstPageBounds.height, true)
        }
        // Recalculate bounds
        bounds = tiledImage.getBounds()
        // Position next page
        tiledImage.setPosition(pos, true)
        pos.x += bounds.width
      }
    }
    // Update viewer zoom
    this.fitPages()
  }

  fitPagesLegacy() {
    const { viewport, world } = this.viewer
    const count = world.getItemCount()
    const tiledImage = world.getItemAt(0)

    if (tiledImage) {
      const bounds = tiledImage.getBounds()
      const margin = 8 / viewport.getContainerSize().x
      bounds.width = (bounds.width + margin) * count
      viewport.fitBoundsWithConstraints(bounds, true)
    }
  }

  fitPages(orientation) {
    const { viewport, world } = this.viewer

    if (!orientation) {
      this.fitPagesLegacy()
    }

    if (orientation === 'vertical') {
      viewport.fitVertically(true)
    }

    if (orientation === 'horizontal') {
      viewport.fitHorizontally(true)
    }
  }

  componentDidMount() {
    const { initialPage } = this.props
    this.initOpenSeaDragon()
    this.renderPage(initialPage)
  }

  componentWillUnmount() {
    this.viewer.destroy()
    this.viewer = null
  }

  componentDidUpdate(prevProps) {
    const { totalPages } = this.context.state
    const { currentPage, bookMode } = this.props

    // Page changed
    if (currentPage !== prevProps.currentPage || bookMode !== prevProps.bookMode) {
      // Render new valid page
      if (currentPage >= 0 && currentPage < totalPages) {
        this.renderPage(currentPage)
      }
    }

    // Page changed
    if (bookMode !== prevProps.bookMode) {
      if (bookMode) {
        // Trigger re-render layout
        this.renderLayout()
      }
    }
  }

  render() {
    const { id } = this.props
    return (
      <React.Fragment>
        <Toolbar updateZoom={this.updateZoom} />
        <div id={id} className={'villain-canvas'} />
      </React.Fragment>
    )
  }
}

export default CanvasRender