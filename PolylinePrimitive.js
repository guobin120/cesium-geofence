const PolylinePrimitive = (function () {
    const createGuid = Cesium.createGuid;
    const defaultValue = Cesium.defaultValue;
    const defined = Cesium.defined;
    const destroyObject = Cesium.destroyObject;
    const ArcType = Cesium.ArcType;
    const BoundingSphere = Cesium.BoundingSphere;
    const Color = Cesium.Color;
    const ColorGeometryInstanceAttribute = Cesium.ColorGeometryInstanceAttribute;
    const Ellipsoid = Cesium.Ellipsoid;
    const GeometryInstance = Cesium.GeometryInstance;
    const PolylineGeometry = Cesium.PolylineGeometry;
    const Material = Cesium.Material;
    const PolylineColorAppearance = Cesium.PolylineColorAppearance;
    const PolylineMaterialAppearance = Cesium.PolylineMaterialAppearance;
    const GroundPolylineGeometry = Cesium.GroundPolylineGeometry;
    const GroundPolylinePrimitive = Cesium.GroundPolylinePrimitive;
    const Primitive = Cesium.Primitive;

    function PolylinePrimitive(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this.show = defaultValue(options.show, true);

        this._ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84);
        this._width = defaultValue(options.width, 3);
        this._color = Color.clone(defaultValue(options.color, Color.WHITE));
        this._id = defaultValue(options.id, createGuid());
        this._positions = defaultValue(options.positions, []);
        this._primitive = undefined;
        this._boundingSphere = new BoundingSphere();
        this._dashed = defaultValue(options.dashed, false);
        this._loop = defaultValue(options.loop, false);
        this._clamped = defaultValue(options.clamped, true);
        this._update = true;
    }

    Object.defineProperties(PolylinePrimitive.prototype, {
        positions : {
            get : function() {
                return this._positions;
            },
            set : function(positions) {
                this._positions = positions;
                this._update = true;
            }
        },
        color : {
            get : function() {
                return this._color;
            },
            set : function(color) {
                this._color = color;
                this._update = true;
            }
        },
        boundingVolume : {
            get : function() {
                return this._boundingSphere;
            }
        },
        width : {
            get : function() {
                return this._width;
            },
            set : function(width) {
                this._width = width;
                this._update = true;
            }
        },
        ellipsoid : {
            get : function() {
                return this._ellipsoid;
            }
        },
        dashed : {
            get : function() {
                return this._dashed;
            }
        },
        loop : {
            get : function() {
                return this._loop;
            },
            set : function (loop) {
                this._loop = loop;
                this._update = true;
            }
        },
        id : {
            get : function() {
                return this._id;
            },
            set : function (id) {
                this._id = id;
            }
        },
        clamped : {
            get : function() {
                return this._clamped;
            },
            set : function (clamped) {
                this._clamped = clamped;
                this._update = true;
            }
        }
    });

    PolylinePrimitive.prototype.update = function(frameState) {
        if (!this.show) {
            return;
        }

        let positions = this._positions;

        if (!defined(positions) || positions.length < 2) {
            this._primitive = this._primitive && this._primitive.destroy();
            return;
        }

        if (this._update) {
            this._update = false;
            this._id = this.id;

            this._primitive = this._primitive && this._primitive.destroy();

            if (this._loop) {
                positions = positions.slice();
                positions.push(positions[0]);
            }

            if(this._clamped)
            {
                const geometry = new GroundPolylineGeometry({
                    positions : positions,
                    width : this.width,
                    arcType : undefined
                });

                this._primitive = new GroundPolylinePrimitive({
                    geometryInstances : new GeometryInstance({
                        geometry : geometry,
                        id : this.id
                    }),
                    appearance : new PolylineMaterialAppearance({
                        material : Material.fromType('Color', {
                            color : this._color
                        })
                    }),
                    asynchronous : false,
                    allowPicking : true
                });
            }
            else {
                const geometry = new PolylineGeometry({
                    positions : positions,
                    width : this.width,
                    vertexFormat : PolylineMaterialAppearance.VERTEX_FORMAT,
                    ellipsoid : this._ellipsoid,
                    arcType : ArcType.NONE
                });

                const appearance1 = new PolylineColorAppearance();

                this._primitive = new Primitive({
                    geometryInstances : new GeometryInstance({
                        geometry : geometry,
                        attributes : {
                            color : ColorGeometryInstanceAttribute.fromColor(this._color),
                            depthFailColor : ColorGeometryInstanceAttribute.fromColor(this._color)
                        },
                        id : this.id
                    }),
                    appearance : appearance1,
                    depthFailAppearance : appearance1,
                    asynchronous : false,
                    allowPicking : true
                });
            }

            this._primitive.polylinePrimitive = this;

            this._boundingSphere = BoundingSphere.fromPoints(positions, this._boundingSphere);
        }

        this._primitive.update(frameState);
    };

    PolylinePrimitive.prototype.isDestroyed = function() {
        return false;
    };

    PolylinePrimitive.prototype.destroy = function() {
        this._primitive = this._primitive && this._primitive.destroy();
        return destroyObject(this);
    };

    return PolylinePrimitive;
})();
