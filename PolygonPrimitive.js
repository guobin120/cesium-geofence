const PolygonPrimitive = (function () {
    const  createGuid = Cesium.createGuid;
    const defaultValue = Cesium.defaultValue;
    const destroyObject  = Cesium.destroyObject;
    const BoundingSphere = Cesium.BoundingSphere;
    const Color = Cesium.Color;
    const ColorGeometryInstanceAttribute = Cesium.ColorGeometryInstanceAttribute;
    const CoplanarPolygonGeometry = Cesium.CoplanarPolygonGeometry;
    const GeometryInstance = Cesium.GeometryInstance;
    const PerInstanceColorAppearance = Cesium.PerInstanceColorAppearance;
    const Primitive = Cesium.Primitive;
    const GroundPrimitive = Cesium.GroundPrimitive;
    const PolygonHierarchy = Cesium.PolygonHierarchy;
    const PolygonGeometry = Cesium.PolygonGeometry;

    function PolygonPrimitive(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        this.show = defaultValue(options.show, true);
        const color = Color.clone(defaultValue(options.color, Color.WHITE));
        this._id = defaultValue(options.id, createGuid());
        this._color = color;
        this._depthFailColor = color;
        this._positions = defaultValue(options.positions, []);

        this._boundingSphere = new BoundingSphere();
        this._primitive = undefined;
        this._clamped = defaultValue(options.clamped, true);
        this._update = true;
    }

    Object.defineProperties(PolygonPrimitive.prototype, {
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

    PolygonPrimitive.prototype.update = function(frameState) {
        if (!this.show) {
            return;
        }

        const positions = this._positions;

        if (positions.length < 3) {
            this._primitive = this._primitive && this._primitive.destroy();
            return;
        }

        if (this._update) {
            this._update = false;

            this._primitive = this._primitive && this._primitive.destroy();

            if(this._clamped)
                this._doUpdateForClamp();
            else
                this._doUpdateForNonClamped();
        }

       this._primitive.update(frameState);
    };

    function getClonedPositions(positions){
        let ret = [];

        positions.forEach((position)=>{
            ret.push(position.clone());
        });

        return ret;
    }

    PolygonPrimitive.prototype._doUpdateForClamp = function() {
        const positions = getClonedPositions(this._positions);

        const geometry = new PolygonGeometry({
            polygonHierarchy : new PolygonHierarchy(positions),
            perPositionHeight : true,
            // vertexFormat : PerInstanceColorAppearance.FLAT_VERTEX_FORMAT
        });

        this._primitive = new GroundPrimitive({
            geometryInstances : new GeometryInstance({
                geometry : geometry,
                attributes : {
                    color : ColorGeometryInstanceAttribute.fromColor(this._color),
                    // depthFailColor : ColorGeometryInstanceAttribute.fromColor(this._depthFailColor)
                },
                id : this._id
            }),
            appearance : new PerInstanceColorAppearance({
                flat : false,
                closed : false,
                translucent : this._color.alpha < 1.0
            }),
            // depthFailAppearance : new PerInstanceColorAppearance({
            //     flat : true,
            //     closed : false,
            //     translucent : this._depthFailColor.alpha < 1.0
            // }),
            allowPicking : true,
            asynchronous : false
        });

        this._primitive.polygonPrimitive = this;

        this._boundingSphere = BoundingSphere.fromPoints(positions, this._boundingSphere);
    };

    PolygonPrimitive.prototype._doUpdateForNonClamped = function() {
        const positions = this._positions;

        var geometry = CoplanarPolygonGeometry.fromPositions({
            positions : positions,
            vertexFormat : PerInstanceColorAppearance.FLAT_VERTEX_FORMAT
        });

        this._primitive = new Primitive({
            geometryInstances : new GeometryInstance({
                geometry : geometry,
                attributes : {
                    color : ColorGeometryInstanceAttribute.fromColor(this._color),
                    depthFailColor : ColorGeometryInstanceAttribute.fromColor(this._depthFailColor)
                },
                id : this._id
            }),
            appearance : new PerInstanceColorAppearance({
                flat : true,
                closed : false,
                translucent : this._color.alpha < 1.0
            }),
            depthFailAppearance : new PerInstanceColorAppearance({
                flat : true,
                closed : false,
                translucent : this._depthFailColor.alpha < 1.0
            }),
            allowPicking : true,
            asynchronous : false
        });

        this._primitive.polygonPrimitive = this;

        this._boundingSphere = BoundingSphere.fromPoints(positions, this._boundingSphere);
    };

    PolygonPrimitive.prototype.isDestroyed = function() {
        return false;
    };

    PolygonPrimitive.prototype.destroy = function() {
        this._primitive = this._primitive && this._primitive.destroy();
        return destroyObject(this);
    };

    return  PolygonPrimitive;

})();
