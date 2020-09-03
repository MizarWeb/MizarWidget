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
 * AdditionalLayersView module
 */
define(["jquery", "moment", "./AdditionalLayersCore", "./PickingManager", "./DynamicImageView", "./LayerServiceView", "service/Samp", "./dialog/ErrorDialog", "../utils/UtilsCore", "underscore", "text!templates/additionalLayers.html", "text!templates/additionalLayer.html", "jquery.nicescroll.min", "jquery.ui"],
    function ($, moment, AdditionalLayersCore, PickingManager, DynamicImageView, LayerServiceView, Samp, ErrorDialog, UtilsCore, _, additionalLayersHTML, additionalLayerHTMLTemplate) {

        var mizarWidgetAPI;
        var configuration;
        var globe;
        var navigation;
        var parentElement;
        var categories = {
            "Other": 'otherLayers',
            "Coordinate systems": 'coordinateSystems'
        };
        var isMobile = false;

        // Template generating the additional layer div in sidemenu
        var additionalLayerTemplate = _.template(additionalLayerHTMLTemplate);

        /**************************************************************************************************************/

        /**
         *    Initialize nice scroll for the given category
         */
        function initNiceScroll(categoryId) {
            // Nice scrollbar initialization
            $('#' + categoryId).niceScroll({
                autohidemode: false
            });
            // Hide scroll while accordion animation
            $(parentElement).on("accordionbeforeactivate", function () {
                $('#' + categoryId).niceScroll().hide();
            });
            // Show&resize scroll on the end of accordion animation
            $(parentElement).on("accordionactivate", function () {
                $('#' + categoryId).niceScroll().show();
                updateScroll(categoryId);
            });
        }

        /**************************************************************************************************************/

        /**
         *    Update scroll event
         */
        function updateScroll(categoryId) {
            $(parentElement).find('#' + categoryId).getNiceScroll().resize();
        }

        /**************************************************************************************************************/

        function initializeSliderOpacity($layerDiv, shortName, gwLayer) {
            // Slider initialisation
            $layerDiv.find('#slider_' + shortName).slider({
                value: gwLayer.getOpacity() * 100,
                min: 20,
                max: 100,
                step: 20,
                slide: function (event, ui) {
                    $("#percentInput_" + shortName).val(ui.value + "%");
                    gwLayer.setOpacity(ui.value / 100);
                    if (gwLayer.subLayers) {
                        for (var i = 0; i < gwLayer.subLayers.length; i++) {
                            gwLayer.subLayers[i].setOpacity(ui.value / 100);
                        }
                    }
                }
            }).slider("option", "disabled", !gwLayer.isVisible());

            // Init percent input of slider
            $("#percentInput_" + shortName).val($("#slider_" + shortName).slider("value") + "%");
        }

        function initializeSliderTime($layerDiv, shortName, gwLayer) {
            var startDate, stopDate, nbValues, resolution, timeDefinitionArray;
            var timeDimension = gwLayer.getDimensions().time;
            var isInterval = false;
            if (timeDimension) {
                var timeUtility = mizarWidgetAPI.getMizarAPI().TimeUtility;
                timeDefinitionArray = timeDimension.value.split(",");
                if(timeUtility.isSampling(timeDefinitionArray[0])) {
                    var minMaxRes = timeDefinitionArray[0].split("/");
                    startDate = moment.utc(minMaxRes[0]);
                    stopDate = moment.utc(minMaxRes[1]);
                    resolution = timeUtility.timeResolution(minMaxRes[2]);
                    nbValues = Math.floor(stopDate.diff(startDate, resolution.unit) / parseInt(resolution.step));
                    isInterval = true;
                } else {
                    startDate = moment.utc(timeDefinitionArray[0]);
                    nbValues = timeDefinitionArray.length-1;
                    isInterval = false;
                }
            }

            $layerDiv.find('#timeSlider_' + shortName).slider({
                value: 0,
                min: 0,
                max: nbValues,
                step: 1,
                slide: function (event, ui) {
                    var isoDate;
                    if(isInterval) {
                        var currentDate = moment.utc(startDate);
                        currentDate.add(parseInt(ui.value) * resolution.step, resolution.unit);
                        isoDate = currentDate.toISOString();
                    } else {
                        isoDate = timeDefinitionArray[parseInt(ui.value)];
                    }
                    $("#timeInput_" + shortName).val(isoDate);
                    gwLayer.setParameter("time",isoDate);
                }
            }).slider("option", "disabled", !gwLayer.isVisible());

            if(timeDimension) {
                $("#timeInput_" + shortName).val(startDate.toISOString());
                $('#time_' + shortName).css('visibility',"show");
                gwLayer.setParameter("time",startDate.toISOString());
            } else {
                $('#time_' + shortName).css('visibility',"hidden");
            }
        }

        /**
         *    Initialize UI of  slider for the given layer
         */
        function initializeSliders($layerDiv, gwLayer) {
            if (typeof gwLayer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }
             */
            var shortName = gwLayer.getShortName();

            // Slider initialisation
            initializeSliderOpacity($layerDiv, shortName, gwLayer);

            initializeSliderTime($layerDiv, shortName, gwLayer);

            //if(gwLayer.name === "Palavas Digital Elevation Model") {
            //    $layerDiv.find('#seaLevelSlider_' + shortName).slider({
            //        value: 0,
            //        min: 0,
            //        max: 6,
            //        step: 1,
            //        slide: function (event, ui) {
            //            $("#seaLevelInput_" + shortName).val((0.5 * ui.value).toFixed(1) + " m");
            //            gwLayer.setParameter("styles", (0.5 * ui.value).toFixed(1) + "m");
            //        }
            //    }).slider("option", "disabled", !gwLayer.isVisible());
            //
            //    // Init percent input of slider
            //    $("#seaLevelInput_" + shortName).val("+" + $("#seaLevelSlider_" + shortName).slider("value") + " m");
            //
            //}

        }



        /**************************************************************************************************************/

        /**
         *    Update all toolbar buttons UI
         */
        function updateButtonsUI($layerDiv) {
            // Init buttons of tool bar
            $layerDiv
                .find('.deleteLayer').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-trash"
                    }
                }).end()
                .find('.zoomTo').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-zoomin"
                    }
                }).end()
                .find('.exportLayer').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-extlink"
                    }
                }).end()
                .find('.downloadAsVO').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-arrowthickstop-1-s"
                    }
                }).end()
                .find('.removeWMS').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-newwin"
                    }
                }).end()
                .find('.isFits').button().end()
                .find('.addFitsView').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-image"
                    }
                }).end()
                .find('.layerServices').button({
                    text: false,
                    icons: {
                        primary: "ui-icon-wrench"
                    }
                }).end()
                .find('.osNext').button({
                    text: true,
                    icons: {
                        primary: "ui-icon-triangle-1-e"
                    }
                });
        }

        /**************************************************************************************************************/

        /**
         *    Add legend for the given layer if possible
         *    Legend represents the "line" for polygon data or image from "iconUrl" for point data
         */
        function addLegend($layerDiv, gwLayer) {
            var $canvas = $layerDiv.find('.legend');
            var canvas = $canvas[0];

            if (UtilsCore.isOpenSearchLayer(gwLayer) || UtilsCore.isMocLayer(gwLayer)
                || UtilsCore.isVectorLayer(gwLayer) || UtilsCore.isGeoJsonLayer(gwLayer) || UtilsCore.isHipsCatLayer(gwLayer)) {
                if (gwLayer.dataType === mizarWidgetAPI.GEOMETRY.Point) {
                    AdditionalLayersCore.generatePointLegend(gwLayer, canvas, gwLayer.style.iconUrl);
                }
                else if (gwLayer.dataType === mizarWidgetAPI.GEOMETRY.LineString) {
                    AdditionalLayersCore.generateLineLegend(gwLayer, canvas);
                }
                else {
                    $canvas.css("display", "none");
                }
            }
            else {
                $canvas.css("display", "none");
            }
        }

        /**************************************************************************************************************/

        /**
         *    Create dialog to modify contrast/colormap of fits layers
         */
        function createDynamicImageDialog(gwLayer) {
            if (typeof gwLayer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }*/
            var shortName = gwLayer.getShortName();
            // Supports fits, so create dynamic image view in dialog
            var dialogId = "addFitsViewDialog_" + shortName;
            var $dialog = $('<div id="' + dialogId + '"></div>').appendTo('body').dialog({
                title: 'Image processing',
                autoOpen: false,
                show: {
                    effect: "fade",
                    duration: 300
                },
                hide: {
                    effect: "fade",
                    duration: 300
                },
                resizable: false,
                width: 'auto',
                minHeight: 'auto',
                close: function () {
                    $('#addFitsView_' + shortName).removeAttr("checked").button("refresh");
                    $(this).dialog("close");
                }
            });

            // Dialog activator
            $('#addFitsView_' + shortName).click(function () {

                if ($dialog.dialog("isOpen")) {
                    $dialog.dialog("close");
                }
                else {
                    $dialog.dialog("open");
                }
            });

            // Add dynamic image view content to dialog
            gwLayer.div = new DynamicImageView(dialogId, {
                id: shortName,
                mizar: mizarWidgetAPI,
                changeShaderCallback: function (contrast) {
                    if (contrast === "raw") {
                        gwLayer.customShader.fragmentCode = gwLayer.rawFragShader;
                    }
                    else {
                        gwLayer.customShader.fragmentCode = gwLayer.colormapFragShader;
                    }
                }
            });
        }

        /**************************************************************************************************************/

        /**
         *    Handler managing BaseLayer "visibility:changed" event
         *    TODO: create view object
         */
        function onVisibilityChange(gwLayer) {
            if (typeof gwLayer === 'undefined') {
                return;
            }
            var isOn = gwLayer.isVisible();
            if (isOn === true) {
                /*              console.log("Visibility set to on for "+gwLayer.name+" with id="+gwLayer.ID);
                 console.log("Change z-index !");
                 console.log("mizar",mizarWidgetAPI);
                 */
                var layers = mizarWidgetAPI.mizarWidgetGui.activatedContext.layers;
                var foundIndex = -1;
                var foundLayer = null;
                for (var i = 0; ((i < layers.length) && (foundIndex < 0)); i++) {
                    if (layers[i].ID === gwLayer.ID) {
                        foundIndex = i;
                        foundLayer = layers[i];
                        //console.log("Found id = "+foundLayer.ID+" for i="+foundIndex);
                    }
                }
                // Place it at top of array
                if (foundIndex >= 1) {
                    // if foundIndex is zéro, layer is still at top
                    for (var j = (foundIndex - 1); j >= 0; j--) {
                        layers[j + 1] = layers[j];
                    }
                    layers[0] = foundLayer;
                }
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }*/
            var shortName = gwLayer.getShortName();
            // Manage 'custom' checkbox
            // jQuery UI button is not sexy enough :)
            // Toggle some classes when the user clicks on the visibility checkbox
            if (gwLayer.subLayers) {
                AdditionalLayersCore.setSublayersVisibility(gwLayer, isOn);
            }

            var toolsDiv = $("#addLayer_" + shortName).find('.layerTools');
            $("#addLayer_" + shortName).find('.slider').slider(isOn ? "enable" : "disable");
            $("#addLayer_" + shortName).find('.sliderTime').slider(isOn ? "enable" : "disable");
            if (isOn) {
                $('.layerTools').slideUp();
                toolsDiv.slideDown();

                // Change button's state
                $('#visible_' + shortName).addClass('ui-state-active').removeClass('ui-state-default')
                    .find('span').addClass('ui-icon-check').removeClass('ui-icon-empty');
            }
            else {
                toolsDiv.slideUp();
                // Change button's state
                $('#visible_' + shortName).removeClass('ui-state-active').addClass('ui-state-default')
                    .find('span').removeClass('ui-icon-check').addClass('ui-icon-empty');
            }

            globe.refresh();
        }

        /**************************************************************************************************************/

        /**
         *    Show/hide layer tools depending on layer visibility
         *    Set visibility event handlers
         */
        function manageLayerVisibility($layerDiv, gwLayer, categoryId) {
            if (typeof gwLayer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }*/
            var shortName = gwLayer.getShortName();
            // Open tools div when the user clicks on the layer label
            var toolsDiv = $layerDiv.find('.layerTools');
            $layerDiv.children('label').click(function () {
                toolsDiv.slideToggle(updateScroll.bind(this, categoryId));
            });

            if (gwLayer.isVisible()) {
                toolsDiv.slideDown();
            }
            if (shortName === "Atmosphere") {
                mizarWidgetAPI.getContext()._atmosphereLayer = gwLayer;
            }

            // Layer visibility management
            $layerDiv.find('#visible_' + shortName).click(function () {
                    var isOn = !$(this).hasClass('ui-state-active');
                    gwLayer.setVisible(isOn);
                
            });
        }

        /**************************************************************************************************************/

        /**
         *    Create the Html for addtionnal layer
         */
        function createHtmlForAdditionalLayer(gwLayer, categoryId) {
            if (typeof gwLayer === 'undefined' || (gwLayer.getType() === mizarWidgetAPI.LAYER.Vector && gwLayer.isDraw() )) {
                // returns when undefined or a draw such as selection, arrow to represent a distance, ... something which is not a data
                return;
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }
             */
            var layerDiv = AdditionalLayersCore.createHTMLFromTemplate(additionalLayerTemplate, gwLayer, gwLayer.getShortName(), isMobile);

            var $layerDiv = $(layerDiv)
                .appendTo('#' + categoryId)
                .data("layer", gwLayer);

            // Add legend
            addLegend($layerDiv, gwLayer);

            // Create UI of sliders
            initializeSliders($layerDiv, gwLayer);

            manageLayerVisibility($layerDiv, gwLayer, categoryId);

            updateButtonsUI($layerDiv);

            if (UtilsCore.isHipsFitsLayer(gwLayer) && !isMobile) {
                //createDynamicImageDialog(gwLayer);
            }
        }

        /**************************************************************************************************************/

        /**
         *    Create HTML for the given layer
         */
        function addView(gwLayer) {
            if (gwLayer.linkedTo !== "" || gwLayer.type === "WCSElevation" || gwLayer.type === "WMSElevation" || gwLayer.type === "Moc") {
                // skip it
            } else {
                var category = gwLayer.category;
                // Other as default
                if (!category) {
                    category = 'Other';
                }

                // Create new category if doesn't exists
                var categoryId;
                if (!categories[category]) {
                    categoryId = UtilsCore.formatId(category);
                    $('<div class="category"><h3>' + category + '</h3>\
			<div id="' + categoryId + '"></div></div>')
                        .insertBefore($('#otherLayers').parent());

                    categories[category] = categoryId;

                    // Refresh accordion
                    $(parentElement).accordion("refresh");
                    // Add scroll to the new category
                    initNiceScroll(categoryId);
                }
                else {
                    categoryId = categories[category];
                    // If it's the first added layer, show the category
                    if ($('#' + categoryId + " .addLayer").length === 0) {
                        $('#' + categoryId).closest(".category").show();
                    }
                }
                if(gwLayer.index && gwLayer.categoryIndex !== "none" ){
                    $("h3:contains('"+category+"')").parent().data("index", gwLayer.index);
                    sortCategories();

                }

                // Add HTML
                createHtmlForAdditionalLayer(gwLayer, categoryId);

                gwLayer.subscribe(mizarWidgetAPI.EVENT_MSG.LAYER_VISIBILITY_CHANGED, onVisibilityChange);
            }
        }

        function sortCategories(){
            var $categories = $("#accordion").find(".category");
            $categories.sort(function(a,b) {
                aIndex = $(a).data('categoryIndex')  || "none";
                bIndex = $(b).data('categoryIndex') || "none";
                return aIndex > bIndex;
           }).appendTo("#accordion");
        }

        /**************************************************************************************************************/

        /**
         *    Remove HTML view of the given layer
         *    Remove the category if the given layer is the last layer of category
         */
        function removeView(gwLayer) {
            if (typeof gwLayer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(gwLayer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }
             */
            var addLayerDiv = $(parentElement).find('#addLayer_' + gwLayer.getShortName());
            if (addLayerDiv.parent().children().length === 1) {
                // Last child to remove -> remove the category
                addLayerDiv.closest('.category').remove();
            } else {
                addLayerDiv.remove();
            }

            if (gwLayer.div) {
                $('#addFitsView_' + gwLayer.div.id).dialog("destroy").remove();
                gwLayer.div = null;
            }

            gwLayer.unsubscribe(mizarWidgetAPI.EVENT_MSG.LAYER_VISIBILITY_CHANGED, onVisibilityChange);
        }

        /**************************************************************************************************************/

        /**
         *    Delete layer handler
         */
        function deleteLayer() {
            $(this).parent().parent().fadeOut(300, function () {
                $(this).remove();
            });

            var layer = $(this).closest(".addLayer").data("layer");
            mizarWidgetAPI.removeLayer(layer.ID);

            updateScroll('otherLayers');
        }

        /**************************************************************************************************************/

        /**
         *    Go to open search next page
         */
        function nextPage() {
            var layer = $(this).closest(".addLayer").data("layer");
            if (layer !== null) {
                layer.nextPage();
            }
        }

        /**************************************************************************************************************/

        /**
         *    Show layer services popup
         */
        function showLayerServices() {
            var layer = $(this).closest(".addLayer").data("layer");
            LayerServiceView.show(layer);
        }

        /**************************************************************************************************************/

        /**
         *    Export the given layer by SAMP
         */
        function exportLayer() {
            if (Samp.isConnected()) {
                var layer = $(this).closest(".addLayer").data("layer");
                var url = AdditionalLayersCore.buildVisibleTilesUrl(layer);
                Samp.sendVOTable(layer, url);
            }
            else {
                ErrorDialog.open("You must be connected to SAMP Hub");
            }
        }

        /**************************************************************************************************************/

        /**
         *    Remove WMS linked layers
         */
        function removeWms() {
            var layer = $(this).closest(".addLayer").data("layer");
            layer.unloadAllWMS();
        }

        /**************************************************************************************************************/

        /**
         *    Download features on visible tiles of the given layer as VO table
         */
        function downloadAsVO() {
            var layer = $(this).closest(".addLayer").data("layer");
            var url = AdditionalLayersCore.buildVisibleTilesUrl(layer);
            url += "&media=votable";
            var posGeo = layer.globe.coordinateSystem.getWorldFrom3D(navigation.center3d);
            var astro = UtilsCore.formatCoordinates(posGeo);
            $(this).parent().attr('href', url)
                .attr('download', layer.name + "_" + astro[0] + '_' + astro[1]);
        }

        /**************************************************************************************************************/

        /**
         *    Zoom to barycenter of all features contained by layer
         *    (available for GlobWeb.VectorLayers only)
         */
        function zoomTo() {
            var layer = $(this).closest(".addLayer").data("layer");
            AdditionalLayersCore.zoomTo(layer);
        }

        /**************************************************************************************************************/

        /**
         *    Toggle layer to fits rendering
         */
        function toggleFits() {
            var isFits = $(this).is(':checked');
            var layer = $(this).closest(".addLayer").data("layer");
            layer.format = isFits ? 'fits' : 'jpg';
            if (!isFits) {
                $(this).nextAll('.addFitsView').button('disable');
            }

            // TODO: make reset function ?
            // layer.setFormat( format );

            var prevId = layer.ID;
            globe.removeLayer(layer);
            globe.addLayer(layer);

            // HACK : Layer id will be changed by remove/add so we need to change the html id
            $('#addLayer_' + prevId).attr('id', 'addLayer_' + layer.ID);
        }

        /**************************************************************************************************************/

        /**
         *    Initialize toolbar events
         */
        function registerEvents() {
            mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_START_LOAD, onLoadStart);
            mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_END_LOAD, onLoadEnd);

            $(parentElement)
                .on("click", '.category .deleteLayer', deleteLayer)
                .on('click', ".category .layerServices", showLayerServices)
                .on('click', ".category .exportLayer", exportLayer)
                .on('click', '.category .downloadAsVO', downloadAsVO)
                .on('click', '.removeWMS', removeWms)
                .on("click", ".category .zoomTo", zoomTo)
                .on('click', '.category .isFits', toggleFits)
                .on('click', '.category .osNext', nextPage);
        }

        /**************************************************************************************************************/

        /**
         *    Show spinner on layer loading
         */
        function onLoadStart(layer) {
            if (typeof layer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(layer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }
             */
            $('#addLayer_' + layer.getShortName()).find('.spinner').stop(true, true).fadeIn('fast');
        }

        /**************************************************************************************************************/

        /**
         *    Hide spinner when layer is loaded
         */
        function onLoadEnd(layer) {
            if (typeof layer === 'undefined') {
                return;
            }
            /*var shortName = UtilsCore.formatId(layer.name);
             if (typeof shortName === 'string') {
             shortName = shortName.replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/gwLayer);, '-');
             }
             */
            $('#addLayer_' + layer.getShortName()).find('.spinner').fadeOut(500);
        }

        /**************************************************************************************************************/

        return {
            /**
             *    Initialize additional layers view
             */
            init: function (options) {
                // Set some globals
                mizarWidgetAPI = options.mizar;
                globe = mizarWidgetAPI.getContext().globe;
                navigation = mizarWidgetAPI.getNavigation();
                isMobile = options.configuration.isMobile;
                configuration = options.configuration;

                AdditionalLayersCore.init(mizarWidgetAPI);

                // Append content to parent element
                parentElement = options.configuration.element;
                $(parentElement).append(additionalLayersHTML);

                // Select default coordinate system event
                $('#defaultCoordSystem').selectmenu({
                    select: function () {
                        var newCoordSystem = $(this).children('option:selected').val();
                        mizarWidgetAPI.setCrs({geoideName: newCoordSystem});
                    },
                    width: 100
                });

                registerEvents();
            },

            /**
             *    Unregister all event handlers
             */
            remove: function () {
                var self = this;
                $(parentElement).find(".addLayer").each(function () {
                    self.removeView($(this).data("layer"));
                });
                $(parentElement).find(".category").remove();

                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_START_LOAD, onLoadStart);
                mizarWidgetAPI.unsubscribeCtx(mizarWidgetAPI.EVENT_MSG.LAYER_END_LOAD, onLoadEnd);

                $(parentElement)
                    .off("click", '.category .deleteLayer', deleteLayer)
                    .off('click', ".category .layerServices", showLayerServices)
                    .off('click', ".category .exportLayer", exportLayer)
                    .off('click', '.category .downloadAsVO', downloadAsVO)
                    .off('click', '.featureService .removeWMS', removeWms)
                    .off("click", ".category .zoomTo", zoomTo)
                    .off('click', '.category .isFits', toggleFits)
                    .off('click', ".category .osNext", nextPage);

                // Remove all created dialogs
                var layers = mizarWidgetAPI.getLayers();
                for (var i = 0; i < layers.length; i++) {
                    var layer = layers[i];
                    if (layer.div) {
                        $('#addFitsViewDialog_' + layer.div.id).dialog("destroy").remove();
                    }
                }

                // Reinit categories
                categories = {
                    "Other": 'otherLayers',
                    "Coordinate systems": 'coordinateSystems'
                };

            },

            addView: addView,
            removeView: removeView,
            hideView: function (layer) {
                $('#addLayer_' + layer.getShortName()).hide();
            },
            showView: function (layer) {
                $('#addLayer_' + layer.getShortName()).show();
            }
        };

    });
