/**
 * MizarWidgetAPI is the wrapper between the GUI of MizarWidget and the API of mizar.
 */
define(["jquery", "underscore-min",
        "./utils/UtilsCore", "MizarWidgetGui",
        "./uws/UWSManager",
        "gw/Mizar", "gw/Utils/Constants","gw/Gui/dialog/ErrorDialog","text!templates/mizarCore.html","gui/LayerManagerView"],
    function ($, _,
              UtilsCore, MizarWidgetGui,
              UWSManager,
              Mizar, Constants, ErrorDialog, mizarCoreHTML,LayerManagerView) {

        // private variables.
        var mizarDiv;
        var options;
        var mizarAPI;
        var self;

        /**
         * Returns the mizar URL.
         * @return {String}
         * @privateet
         */
        var getMizarUrl = function () {
            /**
             *    Store the mizar base urlferf
             *    Used to access to images(Compass, Mollweide, Target icon for name resolver)
             *    Also used to define "star" icon for point data on-fly
             *    NB: Not the best solution of my life.... TODO: think how to improve it..
             */
            // Search throught all the loaded scripts for minified version
            var scripts = document.getElementsByTagName('script');
            var mizarSrc = _.find(scripts, function (script) {
                return script.src.indexOf("MizarWidget.min") !== -1;
            });

            // Depending on its presence decide if Mizar is used on prod or on dev
            var mizarBaseUrl;
            if (mizarSrc) {
                // Prod
                // Extract mizar's url
                mizarBaseUrl = mizarSrc.src.split('/').slice(0, -1).join('/') + '/';
            }
            else {
                // Dev
                // Basically use the relative path from index page
                mizarSrc = _.find(scripts, function (script) {
                    return script.src.indexOf("MizarWidgetAPI") !== -1;
                });
                mizarBaseUrl = mizarSrc.src.split('/').slice(0, -1).join('/') + '/../';
            }
            return mizarBaseUrl;
        };

        /**
         * Applies the shared parameters to options if they exist.
         * @private
         */
        var _applySharedParameters = function (options) {
            var documentURI = window.document.documentURI;
            // Retrieve shared parameters
            var sharedParametersIndex = documentURI
                .indexOf("sharedParameters=");
            if (sharedParametersIndex !== -1) {
                var startIndex = sharedParametersIndex
                    + "sharedParameters=".length;
                var sharedString = documentURI.substr(startIndex);
                if (options.shortener) {
                    $.ajax({
                        type: "GET",
                        url: options.shortener.baseUrl + '/'
                        + sharedString,
                        async: false, // TODO: create callback
                        success: function (sharedConf) {
                            _mergeWithOptions(sharedConf);
                        },
                        error: function (thrownError) {
                            console.error(thrownError);
                        }
                    });
                } else {
                    console.log("Shortener plugin isn't defined, try to extract as a string");
                    var sharedParameters = JSON
                        .parse(decodeURI(sharedString));
                    _mergeWithOptions(sharedParameters);
                }
            }
        };

        /**
         * Removes "C"-like comments lines from string
         * @param string
         * @return {JSON}
         * @private
         */
        var _removeComments = function (string) {
            var starCommentRe = new RegExp("/\\\*(.|[\r\n])*?\\\*/", "g");
            var slashCommentRe = new RegExp("[^:]//.*[\r\n]", "g");
            string = string.replace(slashCommentRe, "");
            string = string.replace(starCommentRe, "");

            return string;
        };

        /**
         * Merges the retrieved shared parameters with Mizar configuration.
         * @param {object} sharedParameters
         * @private
         */
        //TODO décrire shareparameters
        var _mergeWithOptions = function (sharedParameters) {
            // Navigation
            options.navigation.initTarget = sharedParameters.initTarget;
            options.navigation.initFov = sharedParameters.fov;
            options.navigation.up = sharedParameters.up;

            // Layer visibility
            options.layerVisibility = sharedParameters.visibility;
        };

        /**
         * Adds layers to sky (default) or to planet if planetLayer is defined.
         * @param {array} layers to add to a globe : sky or planet
         * @param {PlanetLayer} [planetLayer]
         * @private
         * @fires Mizar#backgroundSurveysReady
         */
        var callbackLayersLoaded = function (layers, planetLayer) {
            // Add surveys
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if(layer.name === "Mars") {
                    loadNoStandardPlanetProviders();
                }
                var gwLayer = self.addLayer(layer, planetLayer);
                // Update layer visibility according to options
                if (options.layerVisibility
                    && options.layerVisibility.hasOwnProperty(layer.name)) {
                    gwLayer.visible(options.layerVisibility[layer.name]);
                }
                mizarAPI.publish("backgroundSurveysReady");
            }
        };

        /**
         * Loads No standard data providers
         */
        var loadNoStandardSkyProviders = function () {
            var planetProvider = mizarAPI.ProviderFactory.create(Mizar.PROVIDER.Planet);
            var starProvider = mizarAPI.ProviderFactory.create(Mizar.PROVIDER.Star);
            var constellationProvider = mizarAPI.ProviderFactory.create(Mizar.PROVIDER.Constellation);
            mizarAPI.registerNoStandardDataProvider("planets", planetProvider.loadFiles);
            mizarAPI.registerNoStandardDataProvider("constellation", constellationProvider.loadFiles);
            mizarAPI.registerNoStandardDataProvider("star", starProvider.loadFiles);
        };

        var loadNoStandardPlanetProviders = function () {
            var craterProvider = mizarAPI.ProviderFactory.create(Mizar.PROVIDER.Crater);
            mizarAPI.registerNoStandardDataProvider("crater", craterProvider.loadFiles);
        };

        /**
         * Loads background data in the background view.
         * @param layers
         * @param {Object} backgroundSurveysFiles
         * @param {String} mizarBaseUrl
         */

        //TODO improve
        var loadBackgroundLayersFromFile = function (layers, backgroundSurveysFiles, mizarBaseUrl) {
            if (_.isEmpty(backgroundSurveysFiles)) {
                callbackLayersLoaded(layers);
                return layers;
            }

            var backgroundFileUrl = backgroundSurveysFiles.shift();
            var mizarUrl = mizarBaseUrl;
            $.ajax({
                type: "GET",
                async: false, // Deal with it..
                //url: mizarBaseUrl + "data/backgroundSurveys.json",
                url: mizarUrl + backgroundFileUrl,
                dataType: "text",
                success: function (response) {
                    response = _removeComments(response);
                    try {
                        layers = layers.concat($.parseJSON(response));
                    } catch (e) {
                        ErrorDialog.open("Background surveys parsing error<br/> For more details see http://jsonlint.com/.");
                        console.error(e.message);
                        //return false;
                    }
                    $.proxy(loadBackgroundLayersFromFile, self)(layers, backgroundSurveysFiles, mizarUrl);
                },
                error: function (thrownError) {
                    console.error(thrownError);
                    $.proxy(loadBackgroundLayersFromFile, self)(layers, backgroundSurveysFiles, mizarUrl);
                }
            });
        };

        /**
         * Loads layers in additional view.
         * @param additionalLayersFiles
         * @param {String} mizarBaseUrl
         */
        //TODO improve
        var loadAdditionalLayersFromFile = function (additionalLayersFiles, mizarBaseUrl) {
            if (_.isEmpty(additionalLayersFiles)) {
                return;
            }
            var additionalLayer = additionalLayersFiles.shift();
            var layers = [];
            $.ajax({
                type: "GET",
                //async: false, // Deal with it..
                url: mizarBaseUrl + additionalLayer.layers,
                dataType: "text",
                success: function (response) {
                    response = _removeComments(response);
                    try {
                        layers = $.parseJSON(response);
                    } catch (e) {
                        ErrorDialog.open("Background surveys parsing error<br/> For more details see http://jsonlint.com/.");
                        console.error(e.message);
                        //return false;
                    }
                    var planetLayer = mizarAPI.getLayerByName(additionalLayer.layerName);
                    callbackLayersLoaded(layers, planetLayer);
                    loadAdditionalLayersFromFile(additionalLayersFiles, mizarBaseUrl);
                    $('#loading').hide();
                },
                error: function (thrownError) {
                    console.error(thrownError);
                    loadAdditionalLayersFromFile(additionalLayersFiles, mizarBaseUrl);
                    $('#loading').hide();
                }
            });
        };

        /**
         * Creates global options for mizar configuration.
         * @param configuration
         * @return {Object}
         * @private
         */
        function createOptions(configuration) {
            var isMobile = ('ontouchstart' in window || (window.DocumentTouch !== undefined && window.DocumentTouch && document instanceof DocumentTouch));
            var sitoolsBaseUrl = configuration.sitoolsBaseUrl ? configuration.sitoolsBaseUrl : "http://demonstrator.telespazio.com/sitools";
            var proxyUrl = configuration.global.proxyUrl ? configuration.global.proxyUrl : null;
            var proxyUse = configuration.global.proxyUse ? configuration.global.proxyUse : null;
            var mizarBaseUrl = getMizarUrl();
            options = {};
            $.extend(options, configuration);
            options.global.sitoolsBaseUrl = sitoolsBaseUrl;
            options.configuration.proxyUrl = proxyUrl;
            options.configuration.proxyUse = proxyUse;
            options.configuration.isMobile = isMobile;
            options.configuration.mizarBaseUrl = getMizarUrl();
            return options;
        }

        function RenderingGlobeFinished() {
            $('#loading').hide();
        }

        /**
         * Entry point to manage Mizar Widget.
         * @param div Div to use for the Widget
         * @param userOptions Configuration properties for the Widget
         * @param callbackInitMain Callback function
         * @constructor
         */
        var MizarWidgetAPI = function (div, userOptions, callbackInitMain) {
            // Sky mode by default
            this.mode = (!_.isEmpty(userOptions.configuration.mode)) ? userOptions.configuration.mode : "Sky";

            mizarDiv = (typeof div === "string") ? document.getElementById(div) : div;

            self = this;

            // Merge default options with user options
            this.options = createOptions(userOptions);

            // Create mizar core HTML
            var mizarContent = _.template(mizarCoreHTML, {});
            $(mizarContent).appendTo(mizarDiv);

            _applySharedParameters(options);

            mizarAPI = new Mizar({
                canvas: $(mizarDiv).find('#GlobWebCanvas')[0],
                configuration: this.options.configuration
            });

            mizarAPI.createContext(Mizar.CONTEXT.Sky, this.options.skyCtx);

            loadNoStandardSkyProviders();

            // Get background surveys only
            // Currently in background surveys there are not only background
            // layers but also catalog ones
            // TODO : Refactor it !

            var layers = [];
            //if (options.backgroundSurveys) {
                // Use user defined background surveys
            //    layers = options.backgroundSurveys;
            //    callbackLayersLoaded(layers);
            //} else {
                layers = $.proxy(loadBackgroundLayersFromFile, this)(layers, this.options.skyCtx.layers, this.options.configuration.mizarBaseUrl + "data/");
            //}

            // Load additionals layers
            $.proxy(loadAdditionalLayersFromFile, this)(this.options.planetCtx.slice(), this.options.configuration.mizarBaseUrl + "data/");

            this.subscribeCtx("baseLayersReady", RenderingGlobeFinished);

            this.mizarWidgetGui = new MizarWidgetGui(mizarDiv, {
                mizarWidgetAPI: this,
                options: this.options
            });

            // Add stats
            if (this.options.configuration.stats.visible) {
                mizarAPI.createStats({
                    element: $("#fps"),
                    verbose: this.options.configuration.stats.verbose ? this.options.configuration.stats.verbose : false
                });
                $("#fps").show();
            }

            // Initialize name resolver
            mizarAPI.getServiceByName(Mizar.SERVICE.NameResolver).init(mizarAPI);

            // Initialize reverse name resolver
            mizarAPI.getServiceByName(Mizar.SERVICE.ReverseNameResolver).init(mizarAPI);

            // UWS services initialization
            UWSManager.init(options);

            // Initialization of tools useful for different modules
            UtilsCore.init(this, options);

            // Initialize moc base
            mizarAPI.getServiceByName(Mizar.SERVICE.MocBase).init(this, options);

            // Fullscreen mode
            document.addEventListener("keydown", function (event) {
                // Ctrl + Space
                if (event.ctrlKey === true && event.keyCode === 32) {
                    $('.canvas > canvas').siblings(":not(canvas)").each(
                        function () {
                            $(this).fadeToggle();
                        });
                }
            });
            //if ((options) && (options.global) && (options.global.displayWarning === true)) {
            //  ErrorDialog.setDisplayWarning(true);
            //  $('#warningButton').on('click', function () {
            //      if (ErrorDialog.isActive() === true) {
            //        ErrorDialog.hide();
            //      } else {
            //        ErrorDialog.view();
            //      }
            //  })
            //} else {
            //  ErrorDialog.setDisplayWarning(false);
            //}
        };


        /**************************************************************************************************************/

        MizarWidgetAPI.prototype.getMizarWidgetGui = function() {
            return this.mizarWidgetGui;
        };

        /**
         * Returns the current Mizar context (Sky/Planet)
         * @function getContext
         * @memberof MizarWidgetAPI.prototype
         * @return {SkyContext} SkyContext
         */
        MizarWidgetAPI.prototype.getContext = function () {
            return mizarAPI.getActivatedContext();
        };

        MizarWidgetAPI.prototype.getRenderContext = function() {
            return mizarAPI.getRenderContext();
        };

        /**
         * Returns the current Scene (Sky or Planet).
         * @function getScene
         * @memberof MizarWidgetAPI.prototype
         * @return {Sky} Scene
         */
        MizarWidgetAPI.prototype.getScene = function () {
            return mizarAPI.getActivatedContext().getScene();
        };

        /**
         * Returns the current Navigation.
         * @function getNavigation
         * @memberof MizarWidgetAPI.prototype
         * @return {AstroNavigation} Navigation
         */
        MizarWidgetAPI.prototype.getNavigation = function () {
            return mizarAPI.getActivatedContext().getNavigation();
        };

        MizarWidgetAPI.prototype.getCrs = function () {
            return mizarAPI.getCrs();
        };

        MizarWidgetAPI.prototype.setCrs = function (coordinateSystem) {
            mizarAPI.setCrs(coordinateSystem);
        };

        MizarWidgetAPI.prototype.subscribeMizar = function (name, callback) {
            mizarAPI.subscribe(name, callback);
        };

        MizarWidgetAPI.prototype.unsubscribeMizar = function (name, callback) {
            mizarAPI.unsubscribe(name, callback);
        };

        MizarWidgetAPI.prototype.publishMizar = function (name, context) {
            mizarAPI.publish(name, context);
        };

        MizarWidgetAPI.prototype.subscribeCtx = function (name, callback) {
            mizarAPI.getActivatedContext().subscribe(name, callback);
        };

        MizarWidgetAPI.prototype.unsubscribeCtx = function (name, callback) {
            mizarAPI.getActivatedContext().unsubscribe(name, callback);
        };

        MizarWidgetAPI.prototype.publishCtx = function (name, context) {
            mizarAPI.getActivatedContext().publish(name, context);
        };


        MizarWidgetAPI.prototype.refresh = function() {
            mizarAPI.getActivatedContext().refresh();
        };

        MizarWidgetAPI.prototype.getTileManager = function() {
            return mizarAPI.getActivatedContext().getTileManager();
        };


        /**
         * Add additional layer(OpenSearch, GeoJSON, HIPS, grid coordinates)
         * @function addLayer
         * @memberof MizarWidgetAPI.prototype
         * @param {Object} layerDesc Layer description
         * @param {Layer} planetLayer Planet layer, if described layer must be added to planet (optional)
         * @return {Layer}The created layer
         */
        MizarWidgetAPI.prototype.addLayer = function (layerDesc, planetLayer) {
            if(layerDesc.coordinateSystem) {
                layerDesc.coordinateSystem = {geoideName: layerDesc.coordinateSystem};
            }
            return mizarAPI.addLayer(layerDesc, planetLayer);
        };


        MizarWidgetAPI.prototype.getServiceByName = function(name, options) {
            return mizarAPI.getServiceByName(name, options);
        };

        MizarWidgetAPI.prototype.SERVICE = Mizar.SERVICE;

        MizarWidgetAPI.prototype.LAYER = Mizar.LAYER;

        MizarWidgetAPI.prototype.CONTEXT = Mizar.CONTEXT;

        MizarWidgetAPI.prototype.CRS = Mizar.CRS;

        MizarWidgetAPI.prototype.GEOMETRY = Mizar.GEOMETRY;

        MizarWidgetAPI.prototype.UTILITY = Mizar.UTILITY;

        MizarWidgetAPI.prototype.NAVIGATION = Mizar.NAVIGATION;

        /**
         * Show/hide angle distance GUI
         * @function setAngleDistanceSkyGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setAngleDistanceSkyGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setAngleDistanceSkyGui(visible);
            }
        };

        /**
         * Show/hide angle distance GUI
         * @function setAngleDistanceSkyGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setAngleDistancePlanetGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setAngleDistancePlanetGui(visible);
            }
        };

        /**
         * Show/hide Switch To 2D
         * @function setSwitchTo2D
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setSwitchTo2D = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setSwitchTo2D(visible);
            }
        };

        /**
         * Show/hide samp GUI
         * Only on desktop
         * @function setSampGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setSampGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setSampGui(visible);
            }
        };

        /**
         * Show/hide shortener GUI
         * @function setShortenerUrlGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setShortenerUrlGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setShortenerUrlGui(visible);
            }
        };

        /**
         * Show/hide 2d map GUI
         * @function setMollweideMapGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setMollweideMapGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setMollweideMapGui(visible);
            }
        };

        /**
         * Show/hide reverse name resolver GUI
         * @function setReverseNameResolverGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setReverseNameResolverGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setReverseNameResolverGui(visible);
            }
        };

        /**
         * Show/hide name resolver GUI
         * @function setNameResolverGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setNameResolverGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setNameResolverGui(visible);
            }
        };

        /**
         * Show/hide jQueryUI layer manager view
         * @function setCategoryGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setCategoryGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setCategoryGui(visible);
            }
        };

        /**
         * Show/hide jQueryUI image viewer GUI
         * @function setImageViewerGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setImageViewerGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setImageViewerGui(visible);
            }
        };

        /**
         * Show/hide jQueryUI Export GUI
         * @function setExportGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setExportGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setExportGui(visible);
            }
        };

        /**
         * Show/hide position tracker GUI
         * @function setPositionTrackerGui
         * @memberof MizarWidgetAPI.prototype
         * @param {boolean} visible
         */
        MizarWidgetAPI.prototype.setPositionTrackerGui = function (visible) {
            if (this.mizarWidgetGui) {
                this.mizarWidgetGui.setPositionTrackerGui(visible);
            }
        };

        MizarWidgetAPI.prototype.getMode = function() {
            return mizarAPI.getActivatedContext().getMode();
        };

        /**
         * Toggle between between 3D and 2D
         * @function toggleDimension
         * @memberof MizarWidgetAPI.prototype
         * @param {Layer} layer the current layer
         */
        MizarWidgetAPI.prototype.toggleDimension = function (layer) {
            mizarAPI.toggleDimension();
            this.setAngleDistancePlanetGui(true);
            this.setSwitchTo2D(true);
        };

        /**
         * Toggle between planet and sky mode
         * @function toggleContext
         * @memberof MizarWidgetAPI.prototype
         * @param {Layer} gwLayer
         * @param {Object} options
         */
        MizarWidgetAPI.prototype.toggleContext = function (gwLayer) {
            var self = this;
            var planetLayers = this.options.planetCtx;
            var ctxOptions = {};
            for (var i=0; i<planetLayers.length && typeof gwLayer !== 'undefined'; i++) {
                var planetLayer = planetLayers[i];
                if(planetLayer.layerName === gwLayer.name) {
                    ctxOptions = planetLayer;
                    break;
                }
            }
            // special case : if in planet context...
            if (mizarAPI.getActivatedContext().getMode() === Mizar.CONTEXT.Planet ) {
              // ...if in 2D dimension...
              if (mizarAPI.getCrs().isFlat()) {
                // before toogle context, we have to toggle dimension
                mizarAPI.toggleDimension();
              }
            }

            mizarAPI.toggleContext(gwLayer, ctxOptions, function() {
                self.mizarWidgetGui.setUpdatedActivatedContext(self.getContext());
                $('#selectedFeatureDiv').hide();
                if (mizarAPI.getActivatedContext().getMode() === Mizar.CONTEXT.Sky) {
                    self.setAngleDistancePlanetGui(false);
                    self.setAngleDistanceSkyGui(true);
                    self.setSwitchTo2D(false);
                    self.setSampGui(true);
                    self.setShortenerUrlGui(true);
                    self.setMollweideMapGui(true);
                    self.setReverseNameResolverGui(true);
                    self.setNameResolverGui(true);
                    self.setCategoryGui(true);
                    self.setImageViewerGui(true);
                    self.setExportGui(true);
                } else {
                    self.setAngleDistanceSkyGui(false);
                    self.setAngleDistancePlanetGui(true);
                    self.setSwitchTo2D(true);
                    self.setSampGui(false);
                    self.setShortenerUrlGui(false);
                    self.setMollweideMapGui(false);
                    self.setReverseNameResolverGui(false);
                    self.setNameResolverGui(true);
                    self.setCategoryGui(true);
                    self.setImageViewerGui(true);
                    self.setExportGui(false);
                }
            });
        };

        MizarWidgetAPI.prototype.getMizarAPI = function () {
            return mizarAPI;
        };

        /**
         * Add layer by drag n drop
         */
        MizarWidgetAPI.prototype.addLayerByDragNDrop = function (name, GeoJson) {
            var layerID = mizarAPI.addLayer({
                name: name,
                type: Mizar.LAYER.GeoJSON,
                pickable: true,
                deletable: true,
                visible:true
            });
            var layer =  mizarAPI.getLayerByID(layerID);

            layer.addFeatureCollection(GeoJson);
        };

        MizarWidgetAPI.prototype.getLayers = function() {
            return mizarAPI.getLayers();
        };

        MizarWidgetAPI.prototype.removeLayer = function(layerID) {
            return mizarAPI.removeLayer(layerID);
        };

        MizarWidgetAPI.prototype.getLayerByName = function(name) {
            return mizarAPI.getLayerByName(name);
        };

        MizarWidgetAPI.prototype.setBackgroundLayer = function(name) {
            return mizarAPI.setBackgroundLayer(name);
        };

        MizarWidgetAPI.prototype.viewPlanet = function(planetName) {
            var marsLayer = this.getLayerByName(planetName);
            this.toggleContext(marsLayer,this.options);
        };

        MizarWidgetAPI.prototype.createLayerFromFits = function (name, fits) {
            // createLayerFromFits: function (name, fits) {
            //     var gwLayer = createSimpleLayer(name);
            //     gwLayer.dataType = "line";
            //
            //     // Create feature
            //     var coords = Utils.getPolygonCoordinatesFromFits(fits);
            //     var feature = {
            //         "geometry": {
            //             "gid": name,
            //             "coordinates": [coords],
            //             "type": "Polygon"
            //         },
            //         "properties": {
            //             "identifier": name
            //         },
            //         "type": "Feature"
            //     };
            //
            //     gwLayer.addFeature(feature);
            //     PickingManagerCore.addPickableLayer(gwLayer);
            //     this.addLayer(gwLayer, mizarCore.activatedContext.planetLayer);
            //     return gwLayer;
            // },
            //TODO A reimplémenter et mettre le bon CRS
        };




        return MizarWidgetAPI;
    });
