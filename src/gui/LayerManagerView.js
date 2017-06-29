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
 * Layer manager view module
 */
define(["jquery", "underscore-min", "../utils/UtilsCore",
        "./dialog/ErrorDialog", "./LayerServiceView", "./BackgroundLayersView", "./AdditionalLayersView", "./ImageProcessing", "jquery.ui"],
    function ($, _, UtilsCore,
              ErrorDialog, LayerServiceView, BackgroundLayersView, AdditionalLayersView, ImageProcessing) {

        /**
         * Private variables
         */
        var mizarWidgetAPI;
        var configuration;

        // GeoJSON data providers
        var votable2geojsonBaseUrl;
        var parentElement;
        var $el;


        /**
         * Private functions
         */

        /**************************************************************************************************************/

        /**
         *    Drop event
         */
        function handleDrop(evt) {
            evt.stopPropagation();
            evt.preventDefault();

            var files = evt.dataTransfer.files; // FileList object.

            // Files is a FileList of File objects.
            loadLayersFromFITSFile(files);
        }

        function loadLayersFromFITSFile(files) {
            $.each(files, function (index, f) {

                var name = f.name;
                var reader = new FileReader();
                $('#loading').show();

                if (f.type === "image/fits") {
                    // Handle fits image
                    reader.onloadend = function (e) {
                        var arrayBuffer = this.result;
                        var fits = mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.FitsVisu).parseFits(arrayBuffer);

                        var gwLayer = mizarWidgetAPI.createLayerFromFits(name, fits);

                        // Add fits texture
                        var featureData = {
                            layer: gwLayer,
                            feature: gwLayer.features[0],
                            isFits: true
                        };
                        var fitsData = fits.getHDU().data;
                        mizarWidgetAPI.publish("image:add", featureData);

                        var image = mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.FitsVisu).handleFits(fitsData, featureData);
                        ImageProcessing.setImage(image);

                        $('#loading').hide();
                    };
                    reader.readAsArrayBuffer(f);
                }
                else {
                    reader.onloadend = function (e) {
                        if (this.result.search('<?xml') > 0) {
                            // Handle xml votable
                            UtilsCore.convertVotable2JsonFromXML(this.result, function (response) {
                                var gwLayer = mizarWidgetAPI.addLayerByDragNDrop(name, response);
                                $('#loading').hide();
                            });
                        }
                        else {
                            // Handle as json if possible
                            var response;
                            try {
                                response = $.parseJSON(this.result);
                                mizarWidgetAPI.addLayerByDragNDrop(name, response);
                                $('#loading').hide();
                            } catch (e) {
                                var message = (e.type) ? e.type : e;
                                ErrorDialog.open("JSON parsing error : " + message + "<br/> For more details see http://jsonlint.com/.");
                                $('#loading').hide();
                                return false;
                            }
                        }
                    };
                    reader.readAsText(f);
                }
            });
        }

        /**************************************************************************************************************/

        /**
         *    Drag over event
         */
        function handleDragOver(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        }

        /**************************************************************************************************************/

        /**
         *    Initialize view with layers stored in <LayerManager>
         */
        function initLayers() {
            var layers = mizarWidgetAPI.getLayers();

            // Add view depending on category of each layer
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if (layer.category === "background") {
                    BackgroundLayersView.addView(layer);
                }
                else {
                    AdditionalLayersView.addView(layer);
                }
            }
        }

        /**************************************************************************************************************/

        /**
         *    Init background layer only from the given planet layer
         */
        function initPlanetLayer(planetLayer) {
            var i,layer;
            // Add planet WMS background layers
            for (i = 0; i < planetLayer.baseImageries.length; i++) {
                layer = planetLayer.baseImageries[i];
                BackgroundLayersView.addView(layer);
            }

            // Add additional layers stored on the given planet layer
            for (i = 0; i < planetLayer.layers.length; i++) {
                layer = planetLayer.layers[i];
                AdditionalLayersView.addView(layer);
            }
        }

        /**************************************************************************************************************/

        return {

            /**
             *    Init
             *
             *    @param m
             *        Mizar API object
             *    @param conf
             *        Mizar configuration
             */
            init: function (widget, conf) {
                mizarWidgetAPI = widget;
                configuration = conf;
                parentElement = configuration.element;
                // Add invoker
                $('<input type="button" id="lmInvoker" />').appendTo(parentElement);
                $el = $('<div id="accordion" style="display: none;"></div>').appendTo(parentElement);
                configuration.element = $el;

                BackgroundLayersView.init({mizar: mizarWidgetAPI, configuration: configuration});
                AdditionalLayersView.init({mizar: mizarWidgetAPI, configuration: configuration});

                mizarWidgetAPI.subscribeCtx("backgroundLayer:add", BackgroundLayersView.addView);
                mizarWidgetAPI.subscribeCtx("additionalLayer:add", AdditionalLayersView.addView);
                mizarWidgetAPI.subscribeMizar("mizarMode:toggle", this.toggleMode);

                // Necessary to drag&drop option while using jQuery
                $.event.props.push('dataTransfer');

                // Due to scroll initialization which corrumps accordion UI init in additional layers view,
                // accordion UI must be initialized before
                $el.accordion({
                    header: "> div > h3",
                    autoHeight: false,
                    active: 0,
                    collapsible: true,
                    heightStyle: "content"
                }).show().accordion("refresh");

                initLayers();
                LayerServiceView.init(mizarWidgetAPI, configuration);

                // Setup the drag & drop listeners.
                $('canvas').on('dragover', handleDragOver);
                $('canvas').on('drop', handleDrop);

                // Layer manager invoker onclick animations
                $('#lmInvoker').click(function () {
                    if (parseFloat($(this).siblings('#accordion').css('left')) < 0) {
                        // Show layer manager
                        $(this).animate({left: '-10px'}, 300).addClass('selected');
                        $(this).siblings('#accordion').animate({left: '15px'}, 300);
                    }
                    else {
                        // Hide layer manager
                        $(this).animate({left: '0px'}, 300).removeClass('selected');
                        $(this).siblings('#accordion').animate({left: '-255px'}, 300);
                    }
                });

                if (!configuration.isMobile) {
                    $('#lmInvoker').trigger("click");
                }

                if (configuration.votable2geojson) {
                    votable2geojsonBaseUrl = configuration.votable2geojson.baseUrl;
                }
            },

            /**
             *    Unregister all event handlers and remove view
             */
            remove: function () {
                AdditionalLayersView.remove();
                BackgroundLayersView.remove();
                LayerServiceView.remove();
                $(parentElement).empty();

                mizarWidgetAPI.unsubscribeCtx("backgroundLayer:add", BackgroundLayersView.addView);
                mizarWidgetAPI.unsubscribeCtx("additionalLayer:add", AdditionalLayersView.addView);
                mizarWidgetAPI.unsubscribeMizar("mizarMode:toggle", this.toggleMode);
                
                $('canvas').off('dragover', handleDragOver);
                $('canvas').off('drop', handleDrop);
            },

            /**
             *    Update view depending on mizar mode
             *
             *    @param planetLayer
             *        Planet layer if toggled in planet mode
             */
            toggleMode: function (context) {
                BackgroundLayersView.remove();
                AdditionalLayersView.remove();
                BackgroundLayersView.init({mizar: mizarWidgetAPI, configuration: configuration});
                AdditionalLayersView.init({mizar: mizarWidgetAPI, configuration: configuration});
                if (mizarWidgetAPI.getMode() === mizarWidgetAPI.CONTEXT.Sky) {
                    // Reinit background&additional views
                    initLayers();
                }
                else {
                    // Reinit only background layers view for the given planet layer
                    //initPlanetLayer(context.planetLayer);
                    initLayers();
                }
                $el.accordion("option", "active", 0).accordion("refresh");
            },

            /**
             *    Returns the state of view
             */
            isInitialized: function () {
                return mizarWidgetAPI ? true : false;
            }
        };

    });
