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
 * Samp module : performing communication between applications using SAMP protocol
 */
define(["jquery", "underscore", "samp", "jquery.ui"],
    function ($, _) {
        var mizarWidgetAPI;
        var imageManager;
        var SampCore;

//var tables = {};
//var highlightStyle = new FeatureStyle( {
//	strokeColor: [1., 1., 1., 1.],
//	fillColor: [1., 1., 1., 1.]
//} );
//var highlightedData;

        var connector;	// SAMP connector
        //var sampLayer;	// SAMP vector layer containing all incoming fits images
        var pointAtReceived = false; // Parameter avoiding looping while receiving coord.pointAt.sky SAMP event
        var votable2geojsonBaseUrl;
        var sitoolsBaseUrl;

        /**************************************************************************************************************/

        /**
         *    Create samp dialog, implement UI events
         */
        function initUI() {
            // Don't use connector.createRegButtons() because there is no unregistration callback
            // to refresh jquery UI buttons
            var dialogContent = '<div id="sampContent"><button id="registerSamp">Register</button>\
					<button id="unregisterSamp" disabled>Unregister</button>\
					<button id="sendVOTable">Send VO table</button>\
					<span><strong>Registered: </strong><span id="sampResult">No</span></span>\
					<br/>\
					<div style="display: none;" id="sampStatus"></div>\
					</div>';

            var $dialog = $(dialogContent).appendTo('body')
                .dialog({
                    title: 'Samp',
                    autoOpen: false,
                    show: {
                        effect: "fade",
                        duration: 300
                    },
                    hide: {
                        effect: "fade",
                        duration: 300
                    },
                    open: function () {
                        // Remove auto-focus
                        $(this).find('button:first-child').blur();
                    },
                    resizable: false,
                    width: 'auto',
                    minHeight: 'auto',
                    close: function (event, ui) {
                        $(this).dialog("close");
                    }
                });

            $dialog.find('#registerSamp').button()
                .click(function () {
                    connector.register();
                }).end()
                .find("#unregisterSamp").button()
                .click(function () {
                    connector.unregister();

                    // Update jQuery UI buttons
                    $('#registerSamp').removeAttr('disabled').button("refresh");
                    $(this).attr('disabled', 'disabled').button("refresh");
                    $('#sampInvoker').toggleClass('selected');
                }).end()
                .find('#sendVOTable').button()
                .click(function () {
                    // DEBUG:
                    var tableUrl = sitoolsBaseUrl + "/sia/search?order=3&healpix=293&coordSystem=EQUATORIAL&media=votable";
                    var msg = new samp.Message("table.load.votable", {"url": tableUrl});
                    connector.connection.notifyAll([msg]);
                });

            $('#sampInvoker').on('click', function () {
                $dialog.dialog("open");
            }).hover(function () {
                $(this).animate({left: '-10px'}, 100);
            }, function () {
                $(this).animate({left: '-20px'}, 100);
            });
        }

        /**************************************************************************************************************/

        /**
         *    Init SAMP module
         */
        function init(m, im, configuration) {
            mizarWidgetAPI = m;
            SampCore = mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.Samp);
            imageManager = im;

            if (configuration.votable2geojson) {
                sitoolsBaseUrl = configuration.sitoolsBaseUrl;
                votable2geojsonBaseUrl = configuration.votable2geojson.baseUrl;
            }

            initUI();
            connector = SampCore.initSamp(mizarWidgetAPI.getMizarAPI());

            // Send pointAt messages when navigation modified
            mizarWidgetAPI.subscribeCtx(mizarWidgetAPI.EVENT_MSG.NAVIGATION_MODIFIED, function () {

                if (connector.connection) {
                    if (!pointAtReceived) {
                        // Mizar is connected to Hub
                        var geoPick = mizarWidgetAPI.getCrs().getWorldFrom3D(mizarWidgetAPI.getNavigation().center3d);
                        var message = new samp.Message("coord.pointAt.sky",
                            {"ra": geoPick[0].toString(), "dec": geoPick[1].toString()});
                        connector.connection.notifyAll([message]);
                    }
                    else {
                        pointAtReceived = false;
                    }
                }
            });

            var sampDesc = {
                type: mizarWidgetAPI.LAYER.Vector,
                name: "SAMP",
                pickable: true,
                dataType: "line"
            };

            mizarWidgetAPI.addLayer(sampDesc);

            window.onbeforeunload = function () {
                // Doesn't work onrefresh actually
                connector.unregister();
            }

        }

        /**************************************************************************************************************/

        return {
            init: init,
            sendImage: function() {SampCore.sendImage},
            sendVOTable: function() {SampCore.sendVOTable},
            highlightFeature: function() {SampCore.highlightFeature},
            isConnected: function() {SampCore.isConnected}
        }

    });
