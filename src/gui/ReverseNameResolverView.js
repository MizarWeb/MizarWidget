/*******************************************************************************
 * Copyright 2012-2015 CNES - CENTRE NATIONAL d'ETUDES SPATIALES
 *
 * This file is part of MIZAR.
 *
 * MIZAR is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MIZAR is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MIZAR. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
/*global define: false */

/**
 * Reverse name resolver view using ReverseNameResolver services
 */
define(["jquery", "underscore-min", "../utils/UtilsCore",
        "./IFrame", "./dialog/ErrorDialog",
        "text!templates/featureDescription.html", "text!templates/descriptionTable.html", "jquery.ui"],
    function ($, _, UtilsCore,
              IFrame, ErrorDialog, 
              featureDescriptionHTMLTemplate, descriptionTableHTMLTemplate) {

        var mizarWidgetAPI;

        var geoPick = [];
        var self;
        var isMobile = false;

        var timeStart;
        var mouseXStart;
        var mouseYStart;

// Template generating the detailed description of choosen feature
        var featureDescriptionTemplate = _.template(featureDescriptionHTMLTemplate);

// Template generating the table of properties of choosen feature
        var descriptionTableTemplate = _.template(descriptionTableHTMLTemplate);

        var reverseNameResolverHTML =
            '<div id="reverseNameResolver" class="contentBox ui-widget-content" style="display: none;">\
                <div id="reverseSearchField">\
                    <input type="submit" value="Find Object Name" />\
                    <div id="coordinatesInfo"></div>\
                    <div id="healpixInfo"></div>\
                </div>\
                <div id="reverseSearchResult"></div>\
                <div class="closeBtn">\
                    <span class="defaultImg"></span>\
                    <span style="opacity: 0" class="hoverImg"></span>\
                </div>\
            </div>';

        var $reverseNameResolver;

        /**************************************************************************************************************/

        /**
         *    Mouse down handler
         *    Registers the position of the mouse and time of click
         */
        function _handleMouseDown(event) {
            //$reverseNameResolver.fadeOut();
            timeStart = new Date();

            if (event.type.search("touch") >= 0) {
                event.clientX = event.changedTouches[0].clientX;
                event.clientY = event.changedTouches[0].clientY;
            }

            mouseXStart = event.clientX;
            mouseYStart = event.clientY;
        }

        /**************************************************************************************************************/

        /**
         *    Mouse up handler
         *    Opens reverse name resolver popup if mouse has been clicked at least 0.5s and hasn't been moved
         */
        function _handleMouseUp(event) {
            var epsilon = 5;

            var timeEnd = new Date();
            var diff = timeEnd - timeStart;

            if (event.type.search("touch") >= 0) {
                event.clientX = event.changedTouches[0].clientX;
                event.clientY = event.changedTouches[0].clientY;
            }

            // More than 0.5 second and the mouse position is approximatively the same
            if (diff > 500 && Math.abs(mouseXStart - event.clientX) < epsilon && Math.abs(mouseYStart - event.clientY) < epsilon) {
                geoPick = mizarWidgetAPI.getContext().getLonLatFromPixel(event.clientX, event.clientY);
                _onCoordinatePicked(event);
            }
        }

        /**************************************************************************************************************/

        /**
         *    Mouse up handler
         *    Opens reverse name resolver popup if mouse has been clicked at least 0.5s and hasn't been moved
         */
        function _onCoordinatePicked(event) {
            var padding = 15;
            var mHeight = window.innerHeight - event.clientY - padding * 2;
            $('#reverseSearchField').css('max-height', mHeight);
            $('#reverseSearchResult').css('max-height', mHeight);
            $('#reverseSearchResult').css("display", "none");

            var astro = mizarWidgetAPI.getCrs().formatCoordinates([geoPick[0], geoPick[1]]);

            if (mizarWidgetAPI.getCrs().getGeoideName() === mizarWidgetAPI.CRS.Equatorial) {
                $("#coordinatesInfo").html("<em>Right ascension:</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + astro[0] +
                    "<br/><em>Declination :</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + astro[1]);
            } else if (mizarWidgetAPI.getCrs().getGeoideName() == mizarWidgetAPI.CRS.Galactic) {
                $("#coordinatesInfo").html("<em>Longitude:</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + astro[0] +
                    "<br/><em>Latitude:</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + astro[1]);
            } else {
                $("#coordinatesInfo").html("<em>Longitude:</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + geoPick[0] +
                    "<br/><em>Latitude:</em><br/>&nbsp;&nbsp;&nbsp;&nbsp;" + geoPick[1]);
            }

            // Use debug mode only for HEALPix tiling
            if (mizarWidgetAPI.options.gui.debug && mizarWidgetAPI.getTileManager().tiling.findInsideTile) {
                var selectedTile = mizarWidgetAPI.getTileManager().getVisibleTile(geoPick[0], geoPick[1]);
                $('#reverseSearchField #healpixInfo').html('<em>Healpix index/order: </em>&nbsp;&nbsp;&nbsp;&nbsp;' + selectedTile.pixelIndex + '/' + selectedTile.order);
            }

            $('#reverseSearchField').css("display", "block");
            $reverseNameResolver.css({
                position: 'absolute',
                left: event.clientX + 'px',
                top: event.clientY + 'px'
            }).fadeIn(100);
        }

        /**************************************************************************************************************/

        /**
         *    Show feature information in popup
         */
        function showFeature(response) {
            // Show only one feature for the moment
            var feature = response.features[0];
            var output = featureDescriptionTemplate({
                dictionary: {},
                services: feature.services,
                properties: feature.properties,
                descriptionTableTemplate: descriptionTableTemplate
            });
            var title = ( feature.properties.title ) ? feature.properties.title : feature.properties.identifier;
            output = '<div class="title">' + title + '</div><div class="credit">Found in CDS database</div>' + output;
            $('#reverseSearchResult')
                .html(output)
                .find('#sendViewport').button();
            $('#reverseSearchField').fadeOut(300, function () {
                $('#reverseSearchResult').fadeIn(300);
            });
            $('#reverseSearchField input[type="submit"]').removeAttr('disabled');
        }

        /**************************************************************************************************************/

        /**
         *    Show error dialog with the status
         */
        function showError(xhr) {
            if (xhr) {
                switch (xhr.status) {
                    case 503:
                        ErrorDialog.open("Please wait at least 6 seconds between each request to reverse name resolver");
                        break;
                    case 500:
                        ErrorDialog.open("Internal server error");
                        break;
                    case 404:
                        ErrorDialog.open("Object not found");
                        break;
                    case 400:
                        ErrorDialog.open("Bad input");
                        break;
                    default:
                        break;
                }
            }
            $('#reverseSearchField input[type="submit"]').removeAttr('disabled');
        }

        /**************************************************************************************************************/

        /**
         *    External link event handler
         */
        function _showIFrame(event) {
            event.preventDefault();
            IFrame.show(event.target.innerHTML);
        }

        /**************************************************************************************************************/

        /**
         *    Hide reverse name resolver popup handler
         */
        function _hidePopup(event) {
            if ($reverseNameResolver && $reverseNameResolver.hasOwnProperty("css") && $reverseNameResolver.css('display') != 'none') {
                $reverseNameResolver.fadeOut(300);
            }
        }

        /**************************************************************************************************************/

        return {
            /**
             *    Init reverse name resolver
             */
            init: function (m) {
                self = this;
                if (!$reverseNameResolver) {
                    mizarWidgetAPI = m;
                    isMobile = mizarWidgetAPI.getMizarWidgetGui().isMobile;

                    $reverseNameResolver = $(reverseNameResolverHTML).appendTo('body');

                    $reverseNameResolver.find("input[type=submit]")
                        .button()
                        .click(function (event) {
                            event.preventDefault();

                            $('#reverseSearchField input[type="submit"]').attr('disabled', 'disabled');

                            mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.ReverseNameResolver).sendRequest(geoPick, {
                                success: showFeature,
                                error: showError
                            });
                        });

                    // External link event
                    $reverseNameResolver.on("click", '.propertiesTable a', _showIFrame);
                    mizarWidgetAPI.subscribeMizar(mizarWidgetAPI.EVENT_MSG.MIZAR_MODE_TOGGLE, self.updateContext);
                    this.updateContext();
                } else {
                    console.error("Reverse name resolver is already initialized");
                }
            },

            /**
             *    Update context to activated one
             */
            updateContext: function () {
                // Activate reverese name resolver if base url is defined for the given layer
                if (mizarWidgetAPI.getContext().getContextConfiguration().reverseNameResolver && mizarWidgetAPI.getContext().getContextConfiguration().reverseNameResolver.baseUrl) {
                    if (mizarWidgetAPI.getContext())
                        self.deactivate();
                    self.activate();
                    mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.ReverseNameResolver).setContext(mizarWidgetAPI.getContext());
                }
                else {
                    self.deactivate();
                }

            },

            /**
             *    Activate reverse name resolver canvas listeners
             */
            activate: function () {
                mizarWidgetAPI.getRenderContext().canvas.addEventListener("mousedown", _handleMouseDown);
                mizarWidgetAPI.getRenderContext().canvas.addEventListener("mouseup", _handleMouseUp);

                if (isMobile) {
                    mizarWidgetAPI.getRenderContext().canvas.addEventListener("touchstart", _handleMouseDown, { passive: true });
                    mizarWidgetAPI.getRenderContext().canvas.addEventListener("touchend", _handleMouseUp);
                }

                mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.NAVIGATION_MODIFIED, _hidePopup);
            },

            /**
             *    Deactivate reverse name resolver canvas listeners
             */
            deactivate: function () {
                mizarWidgetAPI.getRenderContext().canvas.removeEventListener("mousedown", _handleMouseDown);
                mizarWidgetAPI.getRenderContext().canvas.removeEventListener("mouseup", _handleMouseUp);

                if (isMobile) {
                    mizarWidgetAPI.getRenderContext().canvas.removeEventListener("touchstart", _handleMouseDown);
                    mizarWidgetAPI.getRenderContext().canvas.removeEventListener("touchend", _handleMouseUp);
                }

                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.NAVIGATION_MODIFIED, _hidePopup);
            },

            /**
             *    Unregister all binded events
             */
            unregisterEvents: function () {
                this.deactivate();
                // External link event
                $reverseNameResolver.off("click", '.propertiesTable a', _showIFrame);
                mizarWidgetAPI.unsubscribeMizar(mizarWidgetAPI.EVENT_MSG.MIZAR_MODE_TOGGLE, self.updateContext);
            },

            /**
             *    Remove view
             */
            remove: function () {
                if ($reverseNameResolver) {
                    this.unregisterEvents();
                    $reverseNameResolver.remove();
                    $reverseNameResolver = null;
                    mizarWidgetAPI = null;
                }
            },

            isInitialized: function() {
                return mizarWidgetAPI ? true : false
            }
        };

    });
