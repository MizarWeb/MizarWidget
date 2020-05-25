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
 * Name resolver module : search object name and zoom to them
 */
define(["jquery", "underscore","../utils/UtilsCore",
        "text!templates/nameResolverResult.html", "string", "jquery.ui", "jquery.once"],
    function ($, _, UtilsCore, nameResolverResultHTMLTemplate, String) {

        var nameResolverHTML = '<form id="searchForm">\
				<fieldset>\
					<div class="searchInputDiv">\
						<input title="Enter an object name (e.g. m31) or coordinate (e.g 23h45m30.5s -45&#186;30\'30&rdquo;)" type="text" name="searchInput" id="searchInput" value="Object name or coordinates" />\
					</div>\
					<input type="submit" id="searchSubmit" value="" />\
					<div style="display: none" id="searchSpinner"></div>\
					<input type="button" id="searchClear" value="" style="display: none;"/>\
				</fieldset>\
			</form>\
			<div style="display: none" id="resolverSearchResult"></div>';


// Template generating the list of selected features
        var nameResolverResultTemplate = _.template(nameResolverResultHTMLTemplate);

// jQuery selectors
        var $nameResolver;
        var $input;
        var $clear;
        var $resolverSearchResult;

// Name resolver globals
        var response;
        var animationDuration = 300;
        var mizarWidgetAPI;
        var NameResolver;
        var self;


        /**************************************************************************************************************/

        /**
         *    Stylized focus effect on input
         */
        function _focusInput() {
            var defaultText = $input.attr("value");
            if ($input.val() === defaultText) {
                $input.val('');
            }

            $(this).animate({color: '#000'}, animationDuration).parent().animate({backgroundColor: '#fff'}, animationDuration, function () {
                if (!($input.val() === '' || $input.val() === defaultText)) {
                    $clear.fadeIn(animationDuration);
                }
            }).addClass('focus');
        }

        /**************************************************************************************************************/

        /**
         *    Stylized blur effect on input
         */
        function _blurInput(event) {
            var defaultText = $input.attr("value");
            $(this).animate({color: '#b4bdc4'}, animationDuration, function () {
                if ($input.val() === '') {
                    $input.val(defaultText)
                }
            }).parent().animate({backgroundColor: '#e8edf1'}, animationDuration).removeClass('focus');
        }

        /**************************************************************************************************************/

        /**
         *    Toggle visibility of clear button
         *    Designed to clear text in search input
         */
        function _toggleClear() {
            if ($input.val() === '') {
                $clear.fadeOut(animationDuration);
            } else {
                $clear.fadeIn(animationDuration);
            }
        }

        /**************************************************************************************************************/

        /**
         *    Show found results
         */
        function _showResults(data) {
            if (data) {
                response = data;
                // Fill search result field
                var output = "";
                var layers = false;
                var firstObject = true;
                for (var i = 0; i < response.features.length; i++) {
                    var longitude;
                    var latitude;
                    var description = (response.features[i].properties.description == null) ? "" : response.features[i].properties.description;
                    if(response.features[i].properties.type == "layer") {
                        layers = true;
                        longitude = 0;
                        latitude = 0;
                    } else {
                        var astro = mizarWidgetAPI.getCrs().formatCoordinates([response.features[i].geometry.coordinates[0], response.features[i].geometry.coordinates[1]]);
                        longitude = astro[0];
                        latitude = astro[1];
                        firstObject = false;
                    }
                    output += nameResolverResultTemplate({
                        first: firstObject,
                        properties: response.features[i].properties,
                        truncateDescription : String(description).truncate(50).s,
                        lon: longitude,
                        lat: latitude,
                        type: mizarWidgetAPI.getCrs().getType(),
                        index : i
                    });

                }

                // Show it
                $resolverSearchResult.html(output).fadeIn(animationDuration);
                if(!layers) {
                    $resolverSearchResult.find('div:nth-child(2)').addClass('selected');
                }

            }
            $nameResolver.find("#searchSpinner").fadeOut(animationDuration);
            $clear.fadeIn(animationDuration);
        }

        /**************************************************************************************************************/

        /**
         *    Show error message
         */
        function _showError() {
            $resolverSearchResult
                .html("<div class='errorNameResolver'>Bad input or object not found</div>")
                .fadeIn(0);

            $nameResolver.find("#searchSpinner").fadeOut(animationDuration).end();
            $clear.fadeIn(animationDuration);
        }

        /**
         *    Show error message
         */
        function _showErrorOutOfBound() {
            $resolverSearchResult
                .html("<div class='errorNameResolver'>Bad input parameters (coordinates out of extent)</div>")
                .fadeIn(0);

            $nameResolver.find("#searchSpinner").fadeOut(animationDuration).end();
            $clear.fadeIn(animationDuration);
        }

        /**************************************************************************************************************/

        /**
         *    Submit request with string from input
         */
        function _submitRequest(event) {
            event.preventDefault();
            $input.blur();
            var objectName = $input.val();

            if (objectName != $input.attr("value") && objectName != '') {
                $nameResolver
                    .find("#searchSpinner").fadeIn(animationDuration).end()
                    .find('#searchClear').fadeOut(animationDuration);

                $resolverSearchResult.fadeOut(animationDuration);
                NameResolver.goTo(objectName, _showResults, _showError,_showErrorOutOfBound);
            }
            else {
                $resolverSearchResult.html("Enter object name").fadeIn(animationDuration);
            }
        }

        /**************************************************************************************************************/

        /**
         *    Zoom to result by clicking on item of #resolverSearchResult list
         */
        function _zoomToResult(event) {
            $('#resolverSearchResult').find('.selected').removeClass('selected');
            $(this).addClass('selected');

            var index = $(this).attr("mizar_feature_index");
            var selectedFeature = response.features[index];
            NameResolver.zoomTo(selectedFeature.geometry.coordinates[0], selectedFeature.geometry.coordinates[1], null, selectedFeature.geometry.crs.properties.name);
        }

        /**************************************************************************************************************/

        /**
         *    Clear results list
         */
        function _clearResults() {
            $('#resolverSearchResult').fadeOut(animationDuration);
        }

        /**************************************************************************************************************/

        /**
         *    Clear search input
         */
        function _clearInput() {
            var defaultText = $input.attr("value");
            if ($input.val() !== defaultText) {
                $input.val(defaultText);
            }
            $clear.fadeOut(animationDuration);
            $('#searchInput').animate({color: '#b4bdc4'}, animationDuration)
                .parent().animate({backgroundColor: '#e8edf1'}, animationDuration).removeClass('focus');
        }

        /**************************************************************************************************************/

        /**
         *    Initialize events for name resolver
         */
        function setSearchBehavior() {
            // Set style animations
            $input.on('focus', _focusInput)
                .on('blur', _blurInput)
                .keyup(_toggleClear);

            // Submit event
            $('#searchDiv').find('#searchForm').submit(_submitRequest);

            // Clear search result field when pan
            $('canvas').on('click', _clearResults);

            $('#navigationDiv').on('mousewheel','',_mousewheel);
            $('#searchDiv').find('#resolverSearchResult').on("click", '.nameResolverResult.coordinatesResolverResult', _zoomToResult);

            $('#searchDiv').find('#resolverSearchResult').on("click", '.layerResolverResult .nameResolverResult', _selectLayer);
            $nameResolver.find('#searchClear').on('click', _clearInput);
        }

        /**************************************************************************************************************/

        /**
         *    Manage mousewheel event to scroll list of name resolver results
         */
        function _mousewheel(event) {
          var d = $('#navigationDiv');
          var top = d.scrollTop();
          var delta = event.originalEvent.deltaY;
          d.scrollTop( top + delta );
        }

        function _selectLayer(event) {
            var current = $(this).parent();
            if(current.hasClass("selected")) {
                return;
            }
            $('#resolverSearchResult').find('.selected').removeClass('selected');
            $('#resolverSearchResult').find('button').removeAttr('style');

            current.addClass('selected');

            var index = $(current).attr("mizar_feature_index");
            var selectedFeature = response.features[index];
            var layerName = selectedFeature.properties.name;
            var layer = mizarWidgetAPI.getLayerByName(layerName);

            var visible = layer.isVisible();
            var button = $(current).find('.show_or_hide');

            toggleButtonVisibility(layer, button);
            button.button().once().click(function(event) {
                toggleLayer(layer);
                toggleButtonVisibility(layer, button);
            });
        }

        function toggleLayer (layer) {
            if(layer.category == "background") {
                $('#backgroundLayersSelect').val(layer.name).iconselectmenu("refresh");
                //BackgroundLayersView.selectLayer(layer);
            }
            else {
                var visible = layer.isVisible();
                layer.setVisible(!visible);
            }
            return;
        }

        function toggleButtonVisibility(layer, button) {
            var visible = layer.isVisible();
            if(layer.category == "background") {
                if(visible) {
                    button.hide();
                }
                else {
                    button.show();
                    $("span", button).text("Show");
                }
            }
            else {
                $("span", button).text(visible ? "Hide" : "Show");
            }
        }

        /**************************************************************************************************************/

        return {
            /**
             *    Init
             *
             *    @param m
             *        Mizar
             */
            init: function (m) {
                mizarWidgetAPI = m;
                NameResolver = mizarWidgetAPI.getServiceByName(mizarWidgetAPI.SERVICE.NameResolver);
                self = this;
                if (!$nameResolver) {

                    // Update name resolver context when mizar mode has been toggled
                    mizarWidgetAPI.subscribeMizar(mizarWidgetAPI.EVENT_MSG.MIZAR_MODE_TOGGLE, this.onModeToggle);

                    // TODO : replace searchDiv by "parentElement"
                    $nameResolver = $(nameResolverHTML).appendTo('#searchDiv');
                    $input = $nameResolver.find('#searchInput');
                    $clear = $nameResolver.find('#searchClear');
                    $resolverSearchResult = $nameResolver.siblings('#resolverSearchResult');

                    setSearchBehavior();
                } else {
                    console.error("Name resolver view is already initialized");
                }
            },

            /**
             *    Unregister all event handlers
             */
            remove: function () {
                if ($nameResolver) {
                    // Set style animations
                    $input.off('focus', _focusInput)
                        .off('blur', _blurInput)
                        .unbind('keyup', _toggleClear);

                    // Clear search result field when pan
                    $('canvas').off('click', _clearResults);

                    $resolverSearchResult.off("click", '.nameResolverResult.coordinatesResolverResult', _zoomToResult);
                    $resolverSearchResult.off("click", '.nameResolverResult.layerResolverResult', _selectLayer);
                    $nameResolver.find('#searchClear').off('click', _clearInput);
                    $nameResolver.remove();
                    $nameResolver = null;

                    mizarWidgetAPI.unsubscribeMizar(mizarWidgetAPI.EVENT_MSG.MIZAR_MODE_TOGGLE, this.onModeToggle);
                    mizarWidgetAPI = null;
                }
            },

            /**
             *    Handler on mizar mode toggle
             */
            onModeToggle: function (ctx) {
                //if (!ctx.planetLayer || (ctx.planetLayer.nameResolver != undefined && ctx.planetLayer.nameResolver.baseUrl)) {
                    $nameResolver.show();
                    self.setContext(ctx);
                //}
                //else {
                    //$nameResolver.hide();
                //}
            },

            /**
             *    Set new context
             */
            setContext: function (ctx) {
                NameResolver.setContext(ctx);
                _clearInput();
                $resolverSearchResult.css("display", "none");
            },

            toggleButtonVisibility : toggleButtonVisibility,
            toggleLayer : toggleLayer,
            isInitialized : function() {
                return mizarWidgetAPI ? true : false;
            }
        };

    });
