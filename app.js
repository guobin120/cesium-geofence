const Cartesian3 = Cesium.Cartesian3;
const Cartographic = Cesium.Cartographic;
const CesiumMath = Cesium.Math;
const Color = Cesium.Color;

const defaultLongitude = 21.8243;
const defaultLatitude = 39.0742;
const defaultHeight = 10;
const defaultHeading = 0;
const defaultRoll = 0;
const defaultDrawingColor = Color.RED.withAlpha(0.3);
const defaultGraphics = {
  material: defaultDrawingColor,
  outline: true,
  outlineColor: Color.BLACK
};

const rayScratch = new Cesium.Ray();
const cartesianScratch = new Cartesian3();

const defaultPosition = Cartesian3.fromDegrees(
  defaultLongitude,
  defaultLatitude,
  defaultHeight
);

let viewModel = null;
let viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false,
  timeline: false,
});

const scene = viewer.scene;

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(defaultPosition, 50)
);

const types = ["Circle", "Square", "Polygon", "Checking Point"];
let currentType = types[0];

let isDrawing = false;

// for label
let labelCollection = scene.primitives.add(new Cesium.LabelCollection());
let labelOptions = {
  show : true,
  position: null, 
  text: "",
  font : '14px sans-serif',
  fillColor : Color.WHITE,
  horizontalOrigin: Cesium.HorizontalOrigin.CENTER
};
let label = null;


// for Circle
let circleCenterPosition = null;
let dynamicEllipseEntity = null;

// for Square
let upperLeftPosition = null;
let dynamicRectangleEntity = null;
let _rectangle = new Cesium.Rectangle();
let centerCartographicScratch = new Cartographic();
let centerCartesian3Scratch = new Cartesian3();

// for Polygon
let positionsForPolygon = [];
let polygonPrimitiveCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
let polygonPrimitive = null;
let polylinePrimitive = null;
let isMoving = false;

// for checking point
let checkingPointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
let checkingPointLabelCollection = scene.primitives.add(new Cesium.LabelCollection());
let checkingPointPrimitive = checkingPointCollection.add({
  position : new Cartesian3(),
  color : Cesium.Color.GREEN
});

let checkingPointLabelOptions = {
  show : true,
  position: null, 
  text: "",
  font : '14px sans-serif',
  fillColor : Color.GREEN,
  pixelOffset: new Cesium.Cartesian2(10, 4),
  horizontalOrigin: Cesium.HorizontalOrigin.LEFT
};
let checkingPointLabel = labelCollection.add(checkingPointLabelOptions);


createViewModel();
setActions();

function createViewModel() {
  viewModel = {
    types: types,
    currentType: types[0],
  };

  Cesium.knockout.track(viewModel);

  const toolbar = document.getElementById("toolbar");

  Cesium.knockout.applyBindings(viewModel, toolbar);

  Cesium.knockout
    .getObservable(viewModel, "currentType")
    .subscribe(onChangeCurrentType);
}

function getWorldPosition(mousePosition) {
  let position;

  const ray = scene.camera.getPickRay(mousePosition, rayScratch);

  position = scene.globe.pick(ray, scene, cartesianScratch);

  if (Cesium.defined(position)) {
    return Cartesian3.clone(position);
  }

  return undefined;
}

function onChangeCurrentType(type) {
  currentType = type;
}

function getRectangle(position1, position2, result) {
  const cartographic1 = Cartographic.fromCartesian(position1);
  const cartographic2 = Cartographic.fromCartesian(position2);

  // Re-order so west < east and south < north
  result.west = Math.min(cartographic1.longitude, cartographic2.longitude);
  result.east = Math.max(cartographic1.longitude, cartographic2.longitude);
  result.south = Math.min(cartographic1.latitude, cartographic2.latitude);
  result.north = Math.max(cartographic1.latitude, cartographic2.latitude);

  // Check for approx equal (shouldn't require abs due to re-order)
  const epsilon = CesiumMath.EPSILON7;

  if (result.east - result.west < epsilon) {
      result.east += epsilon * 2.0;
  }

  if (result.north - result.south < epsilon) {
      result.north += epsilon * 2.0;
  }

  return result;
}

function checkInCircle(entity, pos) {
  const centerPos = entity.position._value;

  const radius = entity.ellipse.semiMajorAxis._value;
  const newRadius = Cartesian3.distance(centerPos, pos);
  return radius >= newRadius;
}

function checkInPolygon(primitive, pos) {
  const polygon = primitive.positions.map((position) => [position.x, position.y]);
  const point = [pos.x, pos.y];

  let odd = false;
    //For each edge (In this case for each point of the polygon and the previous one)
  for (let i = 0, j = polygon.length - 1; i < polygon.length; i++) {
      //If a line from the point into infinity crosses this edge
      if (((polygon[i][1] > point[1]) !== (polygon[j][1] > point[1])) // One point needs to be above, one below our y coordinate
          // ...and the edge doesn't cross our Y corrdinate before our x coordinate (but between our x coordinate and infinity)
          && (point[0] < ((polygon[j][0] - polygon[i][0]) * (point[1] - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0]))) {
          // Invert odd
          odd = !odd;
      }
      j = i;

  }
  //If the number of crossings was odd, the point is in the polygon
  return odd;
}

function checkInRectangle(entity, pos) {
  const rect = entity.rectangle.coordinates._value;

  const cartographic = Cartographic.fromCartesian(pos);


  return cartographic.longitude >= rect.west && cartographic.longitude <= rect.east && cartographic.latitude >= rect.south && cartographic.latitude <= rect.north;
}

function onLeftClick(movement) {
  const pos = getWorldPosition(movement.position);
  if (!pos) {
    return;
  }

  switch (currentType) {
    case "Checking Point":
      let shapeNameList = [];
      viewer.entities.values.forEach((entity) => {
        if (entity.name.includes("Circle")) {
          if (checkInCircle(entity, pos)) shapeNameList.push(entity.name);
        } else if (entity.name.includes("Square")) {
          if (checkInRectangle(entity, pos)) shapeNameList.push(entity.name);
        }
      });

      for(let i = 0; i < polygonPrimitiveCollection.length; i++) {
        const primitive = polygonPrimitiveCollection.get(i);
        if (checkInPolygon(primitive, pos)) shapeNameList.push(primitive.id);
      }

      let textValue = "outside geofence";
      let colorValue = Color.RED
      if (shapeNameList.length > 0) {
        textValue = "inside  geofence";
        colorValue = Color.BLUE;
      }

      checkingPointPrimitive.position = pos;
      checkingPointPrimitive.color = colorValue;
      
      checkingPointLabel.position = pos;
      checkingPointLabel.text = textValue;
      checkingPointLabel.fillColor = colorValue;      

      break;
    case "Circle":
      if (!isDrawing && !circleCenterPosition) {
        circleCenterPosition = pos;

        dynamicEllipseEntity = viewer.entities.add({
          position: circleCenterPosition,
          name: "Circle " + viewer.entities.values.length,
          ellipse: {
            material: defaultDrawingColor,
            semiMinorAxis: 0.1,
            semiMajorAxis: 0.1,
          },
        });

        label = labelCollection.add({...labelOptions, position: circleCenterPosition});
      } else {
        const radius = Cartesian3.distance(circleCenterPosition, pos);

        // create a new normal entity which has constant property
        viewer.entities.add({
            position: circleCenterPosition,
            name: "Circle " + viewer.entities.values.length,
            ellipse: {
                material: defaultDrawingColor,
                semiMinorAxis: radius,
                semiMajorAxis: radius
            }
        });

        viewer.entities.remove(dynamicEllipseEntity);

        circleCenterPosition = null;
        dynamicEllipseEntity = null;
        label = null;
      }

      isDrawing = !isDrawing;

      break;
    case "Square":
      if (!isDrawing && !dynamicRectangleEntity) {
        upperLeftPosition = pos;

        dynamicRectangleEntity = viewer.entities.add({
          name: "Square " + viewer.entities.values.length,
          rectangle: {
            coordinates: Cesium.Rectangle.fromCartesianArray([upperLeftPosition, upperLeftPosition]),
            ...defaultGraphics
          }
        });

        label = labelCollection.add({...labelOptions, position: upperLeftPosition});
      } else {
        viewer.entities.add({
            name: "Square " + viewer.entities.values.length,
            rectangle: {
              coordinates: Cesium.Rectangle.fromCartesianArray([upperLeftPosition, pos]),
              ...defaultGraphics
            }
        });

        viewer.entities.remove(dynamicRectangleEntity);

        upperLeftPosition = null;
        dynamicRectangleEntity = null;
        label = null;
      }

      isDrawing = !isDrawing;

      break;
    case "Polygon":
      if (!isDrawing && positionsForPolygon.length === 0) {
        polygonPrimitive = polygonPrimitiveCollection.add(new PolygonPrimitive({
          id : `Polygon_${scene.primitives.length}`,
          color : defaultDrawingColor,
          positions : [],
          clamped : false
        }));
        
        polylinePrimitive = scene.primitives.add(new PolylinePrimitive({
          width : 1,
          color : defaultDrawingColor,
          positions : [],
          loop: true,
          clamped : false
        }));
        polygonPrimitive.outlinePolylinePrimitive = polylinePrimitive;
        polylinePrimitive.parentPolygonPrimitive = polygonPrimitive;

        isDrawing = true;
      }

      positionsForPolygon.push(pos);
      polylinePrimitive.positions = [...positionsForPolygon];
      polygonPrimitive.positions = [...positionsForPolygon];
      
      break;
    default:
      break;
  }
  
  
}

function onMouseMove(movement) {
  let pos;

  switch (currentType) {
    case "Circle":
      if (isDrawing && dynamicEllipseEntity) {
        pos = getWorldPosition(movement.endPosition);
        if (pos) {
          const radius = Cartesian3.distance(circleCenterPosition, pos);

          dynamicEllipseEntity.ellipse.semiMinorAxis.setValue(radius);
          dynamicEllipseEntity.ellipse.semiMajorAxis.setValue(radius);
          
          label.text = `${(radius / 1000).toFixed(2)} km`;
        }
      }

      break;
    case "Square":
      if (isDrawing && dynamicRectangleEntity) {
        pos = getWorldPosition(movement.endPosition);
        if (pos) {
          getRectangle(upperLeftPosition, pos, _rectangle);

          dynamicRectangleEntity.rectangle.coordinates.setValue(_rectangle);

          const width = Cartesian3.distance(upperLeftPosition, new Cartesian3(pos.x, upperLeftPosition.y, upperLeftPosition.z));
          const length = Cartesian3.distance(upperLeftPosition, new Cartesian3(upperLeftPosition.x, pos.y, upperLeftPosition.z));
          label.text = `${(width / 1000).toFixed(2)} km X ${(length / 1000).toFixed(2)} km`;

          Cesium.Rectangle.center(_rectangle, centerCartographicScratch);
          Cartesian3.fromRadians(
            centerCartographicScratch.longitude,
            centerCartographicScratch.latitude,
            centerCartographicScratch.height,
            Cesium.Ellipsoid.WGS84,
            centerCartesian3Scratch
          );

          // label.position = new Cartesian3(upperLeftPosition.x + x_diff / 2, upperLeftPosition.x + y_diff / 2, upperLeftPosition.z);
          label.position = centerCartesian3Scratch;
        }
      }

      break;
    case "Polygon":
      if (isDrawing && polylinePrimitive) {
        pos = getWorldPosition(movement.endPosition);
        if (pos) {
          if (isMoving) positionsForPolygon.pop();
          positionsForPolygon.push(pos);
          polylinePrimitive.positions = [...positionsForPolygon];
          polygonPrimitive.positions = [...positionsForPolygon];

          isMoving = true;
        }
      }
      
      break;
    default:
      break;
    }
}

function onRightClick(movement) {
  const pos = getWorldPosition(movement.position);
  if (!pos) {
    return;
  }

  switch (currentType) {
    case "Polygon":
      if (isDrawing && polylinePrimitive) {
        positionsForPolygon.pop();

        positionsForPolygon.push(pos);
        positionsForPolygon.push(positionsForPolygon[0]);

        polylinePrimitive.positions = [...positionsForPolygon];
        polygonPrimitive.positions = [...positionsForPolygon];
        positionsForPolygon = [];

        isDrawing = false;
        isMoving = false;
      }
      
      break;
    default:
      break;
    }
}

function setActions() {
  viewer.screenSpaceEventHandler.setInputAction(
    onLeftClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );

  viewer.screenSpaceEventHandler.setInputAction(
    onMouseMove,
    Cesium.ScreenSpaceEventType.MOUSE_MOVE
  );

  viewer.screenSpaceEventHandler.setInputAction(
    onRightClick,
    Cesium.ScreenSpaceEventType.RIGHT_CLICK
  );
}
