/* eslint-env browser, node */

/*
after including this file you can create your own env, (most time only one is enough)

jsenv.create().setup().then(function(envA) {
    return envA.importMain('fileA.js');
});

jsenv.create().setup().then(function(envB) {
    return envB.importMain('fileB.js');
});
*/

(function() {
    function buildEnv(env) {
        // features.provide adds properties to the features object and can be called anywhere
        function build(data) {
            var properties;

            if (typeof data === 'function') {
                console.log('build', data.name);
                properties = data.call(env);
            } else {
                properties = data;
            }

            if (properties) {
                for (var key in properties) { // eslint-disable-line
                    env[key] = properties[key];
                }
            }
        }

        env.build = build;

        build(function version() {
            function Version(string) {
                var parts = String(string).split('.');
                var major = parts[0];
                var minor = parts[1];
                var patch = parts[2];

                this.major = parseInt(major);
                this.minor = minor ? parseInt(minor) : 0;
                this.patch = patch ? parseInt(patch) : 0;
            }

            function compareVersionPart(a, b) {
                if (a === '*') {
                    return true;
                }
                if (b === '*') {
                    return true;
                }
                return a === b;
            }

            Version.prototype = {
                match: function(version) {
                    if (typeof version === 'string') {
                        version = new Version(version);
                    }

                    return compareVersionPart(this.patch, version.patch) &&
                        compareVersionPart(this.minor, version.minor) &&
                        compareVersionPart(this.major, version.major)
                    ;
                },

                toString: function() {
                    return this.major + '.' + this.minor + '.' + this.patch;
                }
            };

            return {
                createVersion: function(string) {
                    return new Version(string);
                }
            };
        });

        build(function platform() {
            // platform is what runs the agent : windows, linux, mac, ..
            var platform = {
                name: 'unknown',
                version: '',

                setName: function(name) {
                    this.name = name.toLowerCase();
                },

                setVersion: function(version) {
                    this.version = env.createVersion(version);
                },

                match: function(platform) {
                    if ('name' in platform && this.name !== platform.name) {
                        return false;
                    }
                    if ('version' in platform && this.version.match(platform.version) === false) {
                        return false;
                    }

                    return true;
                }
            };

            return {
                platform: platform
            };
        });

        build(function agent() {
            // agent is what runs JavaScript : nodejs, iosjs, firefox, ...
            var type;

            var agent = {
                type: 'unknown',
                name: 'unknown',
                version: 'unknown',

                setName: function(name) {
                    this.name = name.toLowerCase();
                },

                setVersion: function(version) {
                    this.version = env.createVersion(version);
                },

                match: function(agent) {
                    if ('type' in agent && this.type !== agent.type) {
                        return false;
                    }
                    if ('name' in agent && this.name !== agent.name) {
                        return false;
                    }
                    if ('version' in agent && this.version.match(agent.version) === false) {
                        return false;
                    }

                    return true;
                }
            };

            if (typeof window !== 'undefined') {
                if (window.MessageChannel) {
                    type = 'unknown'; // 'webworker';
                } else {
                    type = 'browser';
                }
            } else if (typeof process !== 'undefined' && {}.toString.call(process) === "[object process]") {
                // Don't get fooled by e.g. browserify environments.
                type = 'node';
                agent.setVersion(process.version.slice(1));
            } else {
                type = 'unknown';
            }

            agent.type = type;

            return {
                agent: agent,

                isBrowser: function() {
                    return this.agent.type === 'browser';
                },

                isNode: function() {
                    return this.agent.type === 'node';
                }
            };
        });

        build(function globalAccessor() {
            var globalValue;

            if (this.isBrowser()) {
                globalValue = window;
            } else if (this.isNode()) {
                globalValue = global;
            }

            return {
                global: globalValue
            };
        });

        build(function baseAndInternalURL() {
            var baseURL;
            var internalURL;
            var cleanPath;
            var parentPath;

            parentPath = function(path) {
                return path.slice(0, path.lastIndexOf('/'));
            };

            if (this.isBrowser()) {
                cleanPath = function(path) {
                    return path;
                };

                baseURL = (function() {
                    var href = window.location.href.split('#')[0].split('?')[0];
                    var base = href.slice(0, href.lastIndexOf('/') + 1);

                    return base;
                })();
                internalURL = document.scripts[document.scripts.length - 1].src;
            } else {
                var mustReplaceBackSlashBySlash = process.platform.match(/^win/);
                var replaceBackSlashBySlash = function(path) {
                    return path.replace(/\\/g, '/');
                };

                cleanPath = function(path) {
                    if (mustReplaceBackSlashBySlash) {
                        path = replaceBackSlashBySlash(String(path));
                    }
                    if (/^[A-Z]:\/.*?$/.test(path)) {
                        path = 'file:///' + path;
                    }
                    return path;
                };

                baseURL = (function() {
                    var cwd = process.cwd();
                    var baseURL = cleanPath(cwd);
                    if (baseURL[baseURL.length - 1] !== '/') {
                        baseURL += '/';
                    }
                    return baseURL;
                })();
                internalURL = cleanPath(__filename);
            }

            return {
                baseURL: baseURL, // from where am I running system-run
                internalURL: internalURL, // where is this file
                dirname: parentPath(internalURL), // dirname of this file
                cleanPath: cleanPath,
                parentPath: parentPath
            };
        });

        build(function logger() {
            return {
                logLevel: 'debug', // 'error',

                info: function() {
                    if (this.logLevel === 'info') {
                        console.info.apply(console, arguments);
                    }
                },

                warn: function() {
                    console.warn.apply(console, arguments);
                },

                debug: function() {
                    if (this.logLevel === 'debug') {
                        console.log.apply(console, arguments);
                    }
                }
            };
        });

        build(function cancellableAssignment() {
            return {
                createCancellableAssignment: function(object, name) {
                    var assignmentHandler = {
                        assigned: false,
                        owner: object,
                        name: name,

                        save: function() {
                            if (this.name in this.owner) {
                                this.hasPreviousValue = true;
                                this.previousValue = this.owner[this.name];
                            } else {
                                this.hasPreviousValue = false;
                                this.previousValue = undefined;
                            }
                        },

                        assign: function(value) {
                            if (this.assigned) {
                                throw new Error('value already assigned');
                            }

                            this.owner[this.name] = value;
                            this.assigned = true;
                        },

                        cancel: function() {
                            if (this.assigned === false) {
                                throw new Error('cancel() must be called on assigned value');
                            }

                            if (this.hasPreviousValue) {
                                this.owner[this.name] = this.previousValue;
                            } else {
                                delete this.owner[this.name];
                            }

                            // this.previousValue = undefined;
                            // this.hasPreviousValue = false;
                            this.assigned = false;
                        }
                    };

                    assignmentHandler.save();

                    return assignmentHandler;
                }
            };
        });

        // build(function installGlobalMethod() {
        //     return {
        //         installGlobalMethod: function(globalName, method) {
        //             var handler = this.createCancellableAssignment(this.global, globalName);
        //             handler.assign(method);
        //             // give a way to restore previous global state thanks to globalValueHandler
        //             return handler;
        //         }
        //     };
        // });

        build(function support() {
            var detectors = {};

            return {
                support: function(name) {
                    return Boolean(detectors[name].call(this));
                },

                defineSupportDetector: function(name, detectMethod) {
                    detectors[name] = detectMethod;
                }
            };
        });

        build(function caseTransform() {
            return {
                hyphenToCamel: function(string) {
                    return string.replace(/-([a-z])/g, function(g) {
                        return g[1].toUpperCase();
                    });
                },

                camelToHypen: function(string) {
                    return string.replace(/([a-z][A-Z])/g, function(g) {
                        return g[0] + '-' + g[1].toLowerCase();
                    });
                }
            };
        });

        build(function supportDetectors() {
            var defineSupportDetector = env.defineSupportDetector.bind(env);

            function createPropertyDetector(property, object) {
                property = env.hyphenToCamel(property);

                return function() {
                    return property in object;
                };
            }

            function defineEveryPropertyDetector(properties, object, name) {
                var i = properties.length;
                while (i--) {
                    var property = properties[i];
                    var detectorName;
                    if (name) {
                        detectorName = name + '-' + property;
                    } else {
                        detectorName = property;
                    }
                    defineSupportDetector(detectorName, createPropertyDetector(property, object));
                }
            }

            // global
            defineEveryPropertyDetector([
                'array-buffer',
                'data-view',
                'iterator',
                'map',
                'promise',
                'set',
                'set-immediate',
                'symbol',
                'url',
                'url-search-params',
                'weak-map',
                'reflect'
            ], this.global);

            // array
            defineEveryPropertyDetector([
                'from',
                'of',
                'is-array'
            ], Array, 'array');
            defineEveryPropertyDetector([
                'fill',
                'find',
                'find-index',
                'values',
                'keys',
                'entries',
                'every',
                'some'
            ], Array.prototype, 'array');

            // object
            defineEveryPropertyDetector([
                'assign',
                'create',
                'is'
            ], Object, 'object');

            // string
            defineEveryPropertyDetector([
                'trim',
                'includes',
                'repeat',
                'ends-with',
                'starts-with'
            ], String.prototype, 'string');

            // function
            defineEveryPropertyDetector([
                'bind'
            ], Function.prototype, 'function');

            // other detectors
            (function() {
                function createIteratorDetector(object) {
                    return function() {
                        return Symbol in this.global && Symbol.iterator in object;
                    };
                }

                defineSupportDetector('string-iterator', createIteratorDetector(String.prototype));
                defineSupportDetector('array-iterator', createIteratorDetector(Array.prototype));
                defineSupportDetector('number-iterator', createIteratorDetector(Number.prototype));
            })();

            // property detector overrides
            defineSupportDetector('promise', function() {
                if (('Promise' in this.global) === false) {
                    return false;
                }
                if (Promise.isPolyfill) {
                    return true;
                }
                // agent must implement onunhandledrejection to consider promise implementation valid
                if (this.isBrowser()) {
                    if ('onunhandledrejection' in this.global) {
                        return true;
                    }
                    return false;
                }
                if (this.isNode()) {
                    // node version > 0.12.0 got the unhandledRejection hook
                    // this way to detect feature is AWFUL but for now let's do this
                    if (this.agent.version.major > 0 || this.agent.version.minor > 12) {
                        // apprently node 6.1.0 unhandledRejection is not great too, to be tested
                        if (this.agent.version.major === 6 && this.agent.version.minor === 1) {
                            return false;
                        }
                        return true;
                    }
                    return false;
                }
                return false;
            });

            // es6 support is composed of many check because we will load concatened polyfill
            var es6Requirements = [
                // global requirements
                'iterator',
                'map',
                'promise',
                'set',
                'symbol',
                'weak-map',
                'reflect',
                // array requirements
                'array-from',
                'array-of',
                'array-is-array',
                'array-fill',
                'array-find',
                'array-find-index',
                'array-values',
                'array-keys',
                'array-entries',
                'array-every',
                'array-some',
                'array-iterator',
                // string requirements
                'string-trim',
                'string-includes',
                'string-repeat',
                'string-ends-with',
                'string-starts-with',
                'string-iterator',
                // object requirements
                'object-assign',
                'object-create',
                'object-is'
            ];

            defineSupportDetector('es6', function() {
                var i = es6Requirements.length;
                while (i--) {
                    var es6Requirement = es6Requirements[i];
                    if (this.support(es6Requirement) === false) {
                        this.debug('es6 not supported : missing', es6Requirement);
                        return false;
                    }
                }
                return true;
            });
        });

        build(function coreNeeds() {
            var needs = {};

            ['set-immediate', 'promise', 'url', 'url-search-params', 'es6'].forEach(function(name) {
                needs[name] = this.support(name) === false;
            }, this);

            return {
                needs: needs
            };
        });

        build(function coreModules() {
            function createModuleExportingDefault(defaultExportsValue) {
                /* eslint-disable quote-props */
                return this.System.newModule({
                    "default": defaultExportsValue
                });
                /* eslint-enable quote-props */
            }

            function registerCoreModule(moduleName, defaultExport) {
                this.System.set(moduleName, this.createModuleExportingDefault(defaultExport));
            }

            return {
                createModuleExportingDefault: createModuleExportingDefault,
                registerCoreModule: registerCoreModule
            };
        });

        build(function createSystem() {
            return {
                import: function(a, b) {
                    return this.System.import(a, b);
                },

                createSystem: function() {
                    // dont touch the global System, use a local one
                    var System = Object.create(this.SystemPrototype);
                    System.constructor();

                    System.transpiler = 'babel';
                    // System.trace = true;
                    System.babelOptions = {};
                    System.paths.babel = this.dirname + '/node_modules/babel-core/browser.js';
                    // .json auto handled as json
                    System.meta['*.json'] = {format: 'json'};

                    System.config({
                        map: {
                            'source-map': this.dirname + '/node_modules/source-map'
                        },
                        packages: {
                            "source-map": {
                                main: 'source-map.js',
                                format: 'cjs',
                                defaultExtension: 'js'
                            }
                        }
                    });

                    var oldImport = System.import;
                    System.import = function() {
                        return oldImport.apply(this, arguments).catch(function(error) {
                            if (error && error instanceof Error) {
                                var originalError = error;
                                while ('originalErr' in originalError) {
                                    originalError = originalError.originalErr;
                                }
                                return Promise.reject(originalError);
                            }
                            return error;
                        });
                    };

                    return System;
                },

                configSystem: function() {
                    if (this.isNode()) {
                        // @node/fs etc available thanks to https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L1695
                        this.registerCoreModule('@node/require', require);
                    }

                    this.registerCoreModule(this.moduleName, this);

                    [
                        'agent-more',
                        'exception-handler',
                        'sourcemap-error-stack',
                        'i18n',
                        'language',
                        'module-coverage',
                        'module-import-meta',
                        'module-test',
                        'platform-more',
                        'rest',
                        'restart',
                        'service-http',
                        'stream',
                        'stacktrace'
                    ].forEach(function(libName) {
                        System.paths[this.moduleName + '/' + libName] = this.dirname + '/lib/' + libName + '/index.js';
                    }, this);

                    [
                        'action',
                        'array-sorted',
                        'dependency-graph',
                        'iterable',
                        'lazy-module',
                        'options',
                        'proto',
                        'thenable',
                        'timeout',
                        'uri'
                    ].forEach(function(utilName) {
                        var utilPath = this.dirname + '/lib/util/' + utilName + '/index.js';
                        System.paths[this.moduleName + '/' + utilName] = utilPath;
                        // add a global name too for now
                        System.paths[utilName] = utilPath;
                    }, this);
                }
            };
        });

        build(function setup() {
            return {
                setup: function() {
                    return this.import(this.dirname + '/lib/module-import-meta/index.js').then(function(exports) {
                        this.importMetas = exports.default;
                        return this.import(this.dirname + '/setup.js');
                    }.bind(this)).then(function() {
                        return this;
                    }.bind(this));
                }
            };
        });

        build(function create() {
            return {
                create: function(options) {
                    if (this.globalAssignment.assigned) {
                        // do not remove immediatly to let a chance to create multiple env if needed
                        setImmediate(function() {
                            this.globalAssignment.cancel();
                        }.bind(this));
                    }

                    var customEnv = Object.create(this);

                    customEnv.options = options || {};
                    customEnv.System = customEnv.createSystem();
                    // keep a global System object for now but all code must now do jsenv.System instead of global.System
                    // this way we keep the ability to create many env in the same running context (<- overkill feature + may cause bugs)
                    customEnv.global.System = customEnv.System;
                    customEnv.configSystem();

                    return customEnv;
                }
            };
        });

        // DEPRECATED (not used anymore)
        // build(function include() {
        //     var importMethod;

        //     if (env.isBrowser()) {
        //         importMethod = function(url) {
        //             var script = document.createElement('script');
        //             var promise = new Promise(function(resolve, reject) {
        //                 script.onload = resolve;
        //                 script.onerror = reject;
        //             });

        //             script.src = url;
        //             script.type = 'text/javascript';
        //             document.head.appendChild(script);

        //             return promise;
        //         };
        //     } else {
        //         importMethod = function(url) {
        //             if (url.indexOf('file:///') === 0) {
        //                 url = url.slice('file:///'.length);
        //             }

        //             return new Promise(function(resolve) {
        //                 resolve(require(url));
        //             });
        //         };
        //     }

        //     return {
        //         import: importMethod
        //     };
        // });

        return env;
    }

    function listFiles(env) {
        var files = [];

        function add(name, path) {
            files.push({
                name: name,
                url: env.dirname + '/' + path
            });
        }

        if (env.support('set-immediate') === false) {
            add('set-immediate-polyfill', 'lib/polyfill/set-immediate/index.js');
        }
        if (env.support('promise') === false) {
            add('promise-polyfill', 'lib/polyfill/promise/index.js');
        }
        if (env.support('url') === false) {
            add('url-polyfill', 'lib/polyfill/url/index.js');
        }

        if (env.isBrowser()) {
            add('systemjs', 'node_modules/systemjs/dist/system.js');
        } else {
            add('systemjs', 'node_modules/systemjs/index.js');
        }

        if (env.support('es6') === false) {
            if (env.isBrowser()) {
                add('es6-polyfills', 'node_modules/babel-polyfill/dist/polyfill.js');
            } else {
                add('es6-polyfills', 'node_modules/babel-polyfill/lib/index.js');
            }
        }

        return files;
    }

    function includeFiles(env, files, callback) {
        function includeAllBrowser() {
            var i = 0;
            var j = files.length;
            var file;
            var loadCount = 0;
            var scriptLoadedMethodName = 'includeLoaded';

            var scriptLoadedGlobalMethodAssignment = env.installGlobalMethod(scriptLoadedMethodName, function() {
                loadCount++;
                if (loadCount === j) {
                    scriptLoadedGlobalMethodAssignment.cancel();
                    callback();
                }
            });

            for (;i < j; i++) {
                file = files[i];
                var scriptSource;

                scriptSource = '<';
                scriptSource += 'script type="text/javascript" onload="' + scriptLoadedMethodName + '()" src="';
                scriptSource += file.url;
                scriptSource += '">';
                scriptSource += '<';
                scriptSource += '/script>';

                document.write(scriptSource);
            }
        }

        function includeAllNode() {
            var i = 0;
            var j = files.length;
            var file;
            var url;
            for (;i < j; i++) {
                file = files[i];
                url = file.url;
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                env.debug('include', file.name);
                require(url);
            }
            callback();
        }

        if (env.isBrowser()) {
            includeAllBrowser(files);
        } else {
            includeAllNode(files);
        }
    }

    function createEnv() {
        // create an object that will receive the env
        var env = {};
        // set the name of a future module that will export env
        env.moduleName = 'jsenv';
        // name of the global method used to create env object
        env.globalName = env.moduleName;
        // provide the minimal env available : platform, agent, global, baseAndInternalURl
        buildEnv(env);
        return env;
    }

    var env = createEnv();
    /*
    why put a variable on the global scope ?
    Considering that in the browser you will put a script tag, you need a pointer on env somewhere
    - we could use System.import('jsenv') but this is a wrapper to System so it would be strange
    to access env with something higher level in terms of abstraction
    - we could count on an other global variable but I don't know any reliable global variable for this purpose
    - because it's a "bad practice" to pollute the global scope the provided global is immediatly removed from the global scope
    */

    /*
    Currently we are having the approach of loading env before SystemJS but we could put SystemJS first
    with the babel transpilation then add babel-polyfill and other polyfill.
    A main issue would be the missing unhandledRejection on promise (so let's just force my polyfill before systemjs in that case)
    else everything is ok

    so we could not use global setup(), we could do System.import('jsenv').then(function(jsenv) {});
    moreover now we want the ability to create multiple env it's not possible
    */

    env.globalAssignment = env.createCancellableAssignment(env.global, env.globalName);
    env.globalAssignment.assign(env);

    // list requirements amongst setimmediate, promise, url, url-search-params, es6 polyfills & SystemJS
    var files = listFiles(env);
    includeFiles(env, files, function() {
        env.SystemPrototype = env.global.System;
        delete env.global.System; // remove System from the global scope
    });
})();
