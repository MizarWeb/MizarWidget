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
 * FeaturePopup module
 */
define(["jquery", "./FeaturePopupCore", "./IFrame", "./ImageProcessing", "service/Samp", "underscore-min", "text!templates/featureList.html", "text!templates/featureDescription.html", "text!templates/descriptionTable.html", "jquery.nicescroll.min", "jquery.ui"],
    function ($, FeaturePopupCore, IFrame, ImageProcessing, Samp, _, featureListHTMLTemplate, featureDescriptionHTMLTemplate, descriptionTableHTMLTemplate) {

        var featureListHTML = '';
        var mizarWidgetAPI;
        var pickingManager = null;
        var imageManager = null;
        var configuration;

// Create selected feature div
        /*jshint multistr: true */
        var selectedFeatureDiv = '<div id="selectedFeatureDiv" class="contentBox ui-widget-content" style="display: none">\
				<div id="leftDiv"></div>\
				<div id="rightDiv"></div>\
				<div class="closeBtn">\
					<span class="defaultImg"></span>\
					<span style="opacity: 0" class="hoverImg"></span>\
				</div>\
				<div class="arrow-left"></div>\
            </div>';
            
        var selectedDatacubeDiv = '<div id="selectedDatacubeDiv" title="CNES-DATACUBE"></div>';            

        var $selectedFeatureDiv;
        var $selectedDatacubeDiv;
        var $leftDiv;
        var $rightDiv;

// Template generating the list of selected features
        var featureListTemplate = _.template(featureListHTMLTemplate);

// Template generating the detailed description of choosen feature
        var featureDescriptionTemplate = _.template(featureDescriptionHTMLTemplate);

// Template generating the table of properties of choosen feature
        var descriptionTableTemplate = _.template(descriptionTableHTMLTemplate);

// PileStash help HTML
        var pileStashHelp = '<div id="pileStashHelp"> Some observations are overlapped. <br/> Click on the observation to see detailed informations about each observation. <br/> </div>';

        /**********************************************************************************************/

        return {

            /**
             *    Init
             */
            init: function (mizar, pm, im, conf) {
                mizarWidgetAPI = mizar;
                pickingManager = pm;
                imageManager = im;
                configuration = conf;

                $selectedFeatureDiv = $(selectedFeatureDiv).appendTo('body');
                $selectedDatacubeDiv = $(selectedDatacubeDiv).appendTo('body');

                $leftDiv = $('#leftDiv');
                $rightDiv = $('#rightDiv');

                //FeaturePopupCore.init(mizarWidgetAPI, $selectedFeatureDiv, pm, im, conf);
                //TODO : check argument for FeaturePopupCore.init
                FeaturePopupCore.init(mizarWidgetAPI, $selectedFeatureDiv, pm, im, conf, $selectedDatacubeDiv);

                // Initialize image processing popup
                ImageProcessing.init({
                    mizar: mizarWidgetAPI,
                    disable: function () {
                        $('#dynamicImageView').removeClass('dynamicAvailable').addClass('dynamicNotAvailable');
                    },
                    unselect: function () {
                        $('#dynamicImageView').removeClass('selected');
                    }
                });

                // Show/hide quicklook
                $selectedFeatureDiv.on("click", '#quicklook', FeaturePopupCore.showOrHideQuicklook);

                // Show/hide quicklook wms
                $selectedFeatureDiv.on("click", '#quicklookWms', FeaturePopupCore.showOrHideQuicklookWms);

                // Show/hide quicklook fits
                $selectedFeatureDiv.on('click', "#quicklookFits", FeaturePopupCore.showOrHideQuicklookFits);

                // Show/hide Dynamic image service
                $selectedFeatureDiv.on("click", '#dynamicImageView', FeaturePopupCore.showOrHideDynamicImageService);

                // Send image by Samp
                $selectedFeatureDiv.on("click", '#sendImage', FeaturePopupCore.sendImageBySamp);

                // Show/hide HEALPix service
                $selectedFeatureDiv.on("click", '#healpix', FeaturePopupCore.showOrHideHEALPixService);

                // Show/hide DataCube
                $selectedFeatureDiv.on("click", '#datacube', FeaturePopupCore.showOrHideDataCube);

                // Arrow scroll events
                $selectedFeatureDiv.on("mousedown", '#scroll-arrow-down.clickable', function () {
                    $('#selectedFeatureDiv #scroll-arrow-up').css("border-bottom-color", "orange").addClass("clickable");
                    var $featureList = $('#featureList');
                    var animationStep = parseInt($('#featureListDiv').css('max-height')) / 2;
                    var topValue = parseInt($featureList.css("top"), 10) - animationStep;
                    var height = $featureList.height();
                    var maxHeight = parseInt($('#featureListDiv').css("max-height"));
                    if (topValue <= -(height - maxHeight)) {
                        topValue = -(height - maxHeight);
                        $(this).css("border-top-color", "gray").removeClass("clickable");
                    }
                    $featureList.stop().animate({top: topValue + "px"}, 300);
                }).disableSelection();

                $selectedFeatureDiv.on("mousedown", '#scroll-arrow-up.clickable', function () {
                    $('#selectedFeatureDiv #scroll-arrow-down').css("border-top-color", "orange").addClass("clickable");
                    var $featureList = $('#featureList');
                    var animationStep = parseInt($('#featureListDiv').css('max-height')) / 2;
                    var topValue = parseInt($featureList.css("top"), 10) + animationStep;
                    if (topValue >= 0) {
                        topValue = 0;
                        $(this).css("border-bottom-color", "gray").removeClass("clickable");
                    }
                    $featureList.stop().animate({top: topValue + "px"}, 300);
                }).disableSelection();

                // Show/hide subsection properties
                $selectedFeatureDiv.on("click", '.section', function () {

                    $selectedFeatureDiv.find('.featureProperties').getNiceScroll().hide();
                    // TODO slideToggle works with div -> add div to the tab generation
                    $(this).siblings('table').fadeToggle("slow", "linear", function () {
                        $selectedFeatureDiv.find('.featureProperties').getNiceScroll().show();
                        $selectedFeatureDiv.find('.featureProperties').getNiceScroll().resize();
                    });
                    /*slideToggle(300)*/
                    if ($(this).siblings('#arrow').is('.arrow-right')) {
                        $(this).siblings('#arrow').removeClass('arrow-right').addClass('arrow-bottom');
                    }
                    else {
                        $(this).siblings('#arrow').removeClass('arrow-bottom').addClass('arrow-right');
                    }
                });

                // Choose feature by clicking on its title
                var self = this;
                $selectedFeatureDiv.on("click", '.featureTitle', FeaturePopupCore.selectFeatureOnTitle);

                // Show/hide external resource
                $selectedFeatureDiv.on("click", '.propertiesTable a', function (event) {
                    event.preventDefault();
                    IFrame.show(event.target.innerHTML);
                });

                $selectedFeatureDiv.on("click", '.featureProperties a', function (event) {
                    event.preventDefault();
                    IFrame.show(event.target.href);
                });

                $rightDiv.css('max-width', $('#' + mizarWidgetAPI.getRenderContext().canvas.id).width() / 4);

                // Make rightDiv always visible depending on viewport
                $(window).on('resize', function () {
                    $rightDiv.find('.featureProperties').css('max-height', FeaturePopupCore.computeHeight());
                    $rightDiv.css('max-width', $('#' + mizarWidgetAPI.getRenderContext().canvas.id).width() / 4);
                });

            },

            // Exposing FeaturePopupCore methods to keep existing API
            hide: FeaturePopupCore.hide,
            show: FeaturePopupCore.show,
            createFeatureList: FeaturePopupCore.createFeatureList,
            showFeatureInformation: FeaturePopupCore.showFeatureInformation,


            /**********************************************************************************************/

            /**
             *    Insert HTML code of help to iterate on each feature
             */
            createHelp: function () {
                $rightDiv.html(pileStashHelp);
            }

            /**********************************************************************************************/

        };

    });
