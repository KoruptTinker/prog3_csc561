/* GLOBAL CONSTANTS AND VARIABLES */
const WIN_Z = 0;
const WIN_LEFT = 0; const WIN_RIGHT = 1;
const WIN_BOTTOM = 0; const WIN_TOP = 1;
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog4/triangles.json";
const INPUT_LIGHT_URL = "https://ncsucgclass.github.io/prog3/lights.json";
const INPUT_TEXTURES_URL = "https://korupttinker.github.io/prog4_csc561/";
const INPUT_MAKE_IT_YOUR_OWN_URL = "https://korupttinker.github.io/prog4_csc561/scene_triangles_cat.json";

var Eye = new vec4.fromValues(0.11, 0.5, -1.49, 1.0);
var ViewUp = new vec4.fromValues(0.0, 1.0, 0.0, 1.0);

/* webgl globals */
var gl = null;
var vertexBuffer;
var vertexPositionAttrib;
var altPosition;
var altPositionUniform;

var uvBuffer;
var vertexUVAttrib;

var indexBuffer;
var indexArray = [];

var textureArray = [];
var textureUniform;

var viewMat;
var viewMatUniform;

var projectionMat;
var projectionMatUniform;

var modelMat = [];
var modelMatUniform;

var blendMode = 0;

var opaqueSetIndices = [];
var transparentSetIndices = [];
var catCloneOffsets = {};
var catSetIndices = [];
var catSpinAnimation = null;
var catSpinAxis = [0, 0, -1];
var catSpinToggleCount = 0;
var fastSpinAudio = null;
var slowSpinAudio = null;

const Target = [0.11, 0.5, -0.6];
const distanceFromScreen = 0.5;
var yawAngle = 0;
var pitchAngle = 0;

var selectedSet = -1;

var TriangleSetInfo = [];

function roundTo(value, decimals) {
  var d = (typeof decimals === "number") ? decimals : 4;
  var factor = Math.pow(10, d);
  return Math.round(value * factor) / factor;
}

function formatVec(vec, decimals) {
  var d = decimals || 4;
  return vec.map(function(value) { return roundTo(value, d); });
}

function normalizeVec(vec) {
  var length = Math.hypot(vec[0], vec[1], vec[2]);
  if (length === 0) return [0, 0, 0];
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

function logCameraState(reason) {
  var forward = [
    Target[0] - Eye[0],
    Target[1] - Eye[1],
    Target[2] - Eye[2]
  ];
  var forwardDir = normalizeVec(forward);
  var distance = Math.hypot(forward[0], forward[1], forward[2]);
  console.log("[Camera] " + reason, {
    eye: formatVec([Eye[0], Eye[1], Eye[2]]),
    target: formatVec([Target[0], Target[1], Target[2]]),
    forward: formatVec(forwardDir),
    distance: roundTo(distance, 4),
    yawDeg: roundTo(radToDeg(yawAngle), 2),
    pitchDeg: roundTo(radToDeg(pitchAngle), 2)
  });
}

function decomposeModelMatrix(matrix) {
  var translation = [matrix[12], matrix[13], matrix[14]];
  var scale = [
    Math.hypot(matrix[0], matrix[1], matrix[2]),
    Math.hypot(matrix[4], matrix[5], matrix[6]),
    Math.hypot(matrix[8], matrix[9], matrix[10])
  ];

  var right = [
    matrix[0] / (scale[0] || 1),
    matrix[1] / (scale[0] || 1),
    matrix[2] / (scale[0] || 1)
  ];
  var up = [
    matrix[4] / (scale[1] || 1),
    matrix[5] / (scale[1] || 1),
    matrix[6] / (scale[1] || 1)
  ];
  var forward = [
    matrix[8] / (scale[2] || 1),
    matrix[9] / (scale[2] || 1),
    matrix[10] / (scale[2] || 1)
  ];

  var m00 = right[0],  m01 = up[0],  m02 = forward[0];
  var m10 = right[1],  m11 = up[1],  m12 = forward[1];
  var m20 = right[2],  m21 = up[2],  m22 = forward[2];

  var pitch, yaw, roll;
  if (Math.abs(m20) < 0.999999) {
    pitch = Math.asin(-m20);
    roll = Math.atan2(m21, m22);
    yaw = Math.atan2(m10, m00);
  } else {
    pitch = Math.asin(-m20);
    roll = 0;
    yaw = Math.atan2(-m01, m11);
  }

  return {
    translation: translation,
    scale: scale,
    axes: {
      right: right,
      up: up,
      forward: forward
    },
    eulerXYZDeg: [
      roundTo(radToDeg(pitch), 2),
      roundTo(radToDeg(yaw), 2),
      roundTo(radToDeg(roll), 2)
    ]
  };
}

function logSelectedSetState(reason) {
  if (selectedSet < 0 || selectedSet >= modelMat.length) {
    console.log("[Object] " + reason + " (no selection)");
    return;
  }
  var decomposition = decomposeModelMatrix(modelMat[selectedSet]);
  var setInfo = TriangleSetInfo[selectedSet] || {};
  console.log("[Object set " + selectedSet + "] " + reason, {
    texture: setInfo.texture || null,
    translation: formatVec(decomposition.translation),
    scale: formatVec(decomposition.scale),
    eulerXYZDeg: decomposition.eulerXYZDeg,
    axes: {
      right: formatVec(decomposition.axes.right),
      up: formatVec(decomposition.axes.up),
      forward: formatVec(decomposition.axes.forward)
    },
    boundsCenter: setInfo.bounds ? formatVec(setInfo.bounds.center) : null
  });
}

/* ASSIGNMENT HELPER FUNCTIONS */

function getJSONFile(url, descr) {
  try {
    if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
      throw "getJSONFile: parameter not a string";
    else {
      var httpReq = new XMLHttpRequest();
      httpReq.open("GET", url, false);
      httpReq.send(null);
      var startTime = Date.now();
      while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now() - startTime) > 3000)
          break;
      }
      if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
        throw "Unable to open " + descr + " file!";
      else
        return JSON.parse(httpReq.response);
    }
  }

  catch (e) {
    console.log(e);
    return (String.null);
  }
}

function getTextureImage(textureName) {
  return new Promise(function(resolve, reject) {
    var image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function() {
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resolve(texture);
    };
    image.onerror = function() {
      console.error("Failed to load texture: " + INPUT_TEXTURES_URL + textureName);
      reject(new Error("Failed to load texture: " + textureName));
    };
    image.src = INPUT_TEXTURES_URL + textureName;
  });
}

function setupWebGL() {

  var imageCanvas = document.getElementById("myImageCanvas");
  var cw = imageCanvas.width, ch = imageCanvas.height;
  var imageContext = imageCanvas.getContext("2d");
  var bkgdImage = new Image();
  bkgdImage.crossOrigin = "Anonymous";
  bkgdImage.src = "https://ncsucgclass.github.io/prog3/sky.jpg";
  bkgdImage.onload = function(){
    var iw = bkgdImage.width, ih = bkgdImage.height;
    imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
  };

  var canvas = document.getElementById("myWebGLCanvas");
  gl = canvas.getContext("webgl", { alpha: true });

  try {
    if (gl == null) {
      throw "unable to create gl context -- is your browser gl ready?";
    } else {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  catch (e) {
    console.log(e);
  }

}

function loadTriangles() {
  TriangleSetInfo = [];
  modelMat = [];
  indexArray = [];
  textureArray = [];
  opaqueSetIndices = [];
  transparentSetIndices = [];
  catCloneOffsets = {};
  catSetIndices = [];
  selectedSet = -1;

  var inputTriangles = getJSONFile(INPUT_MAKE_IT_YOUR_OWN_URL, "triangles");
  if (inputTriangles != String.null) {
    var whichSetVert;
    var whichSetTri;
    var coordArray = [];
    var indexOffset = 0;
    var totalTriangles = 0;
    var uvArray = [];
    var textureNameArray = [];
    var sceneMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    var sceneMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    var diagnosticSets = [];
    for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
      var setData = {
        startIdx: totalTriangles * 3,
        alpha: 1.0,
        texture: inputTriangles[whichSet].material.texture || null
      };
      var avgPos = [0, 0, 0];
      var setMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
      var setMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
      var normalSum = [0, 0, 0];
      var normalCount = 0;
      textureNameArray.push(inputTriangles[whichSet].material.texture);
      for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
        var vertex = inputTriangles[whichSet].vertices[whichSetVert];
        coordArray = coordArray.concat(vertex);
        avgPos[0] += vertex[0];
        avgPos[1] += vertex[1];
        avgPos[2] += vertex[2];
        for (var axis = 0; axis < 3; axis++) {
          setMin[axis] = Math.min(setMin[axis], vertex[axis]);
          setMax[axis] = Math.max(setMax[axis], vertex[axis]);
          sceneMin[axis] = Math.min(sceneMin[axis], vertex[axis]);
          sceneMax[axis] = Math.max(sceneMax[axis], vertex[axis]);
        }
        var uv = inputTriangles[whichSet].uvs[whichSetVert] || [0, 0];
        uvArray = uvArray.concat(uv);
        if (inputTriangles[whichSet].normals && inputTriangles[whichSet].normals[whichSetVert]) {
          var normal = inputTriangles[whichSet].normals[whichSetVert];
          normalSum[0] += normal[0];
          normalSum[1] += normal[1];
          normalSum[2] += normal[2];
          normalCount++;
        }
      }
      avgPos[0] /= inputTriangles[whichSet].vertices.length;
      avgPos[1] /= inputTriangles[whichSet].vertices.length;
      avgPos[2] /= inputTriangles[whichSet].vertices.length;
      var setCenter = [
        (setMin[0] + setMax[0]) / 2,
        (setMin[1] + setMax[1]) / 2,
        (setMin[2] + setMax[2]) / 2
      ];
      var setSize = [
        setMax[0] - setMin[0],
        setMax[1] - setMin[1],
        setMax[2] - setMin[2]
      ];
      var setDiagonal = Math.hypot(setSize[0], setSize[1], setSize[2]);
      var fovRadians = Math.PI / 2;
      var radius = setDiagonal * 0.5;
      var cameraDistance = radius > 0 ? radius / Math.tan(fovRadians / 2) : 1.0;
      var suggestedEye = [
        setCenter[0],
        setCenter[1],
        setCenter[2] - cameraDistance
      ];
      var translationToCenter = [
        -setCenter[0],
        -setCenter[1],
        -setCenter[2]
      ];
      var avgNormal = null;
      if (normalCount > 0) {
        var length = Math.hypot(normalSum[0], normalSum[1], normalSum[2]);
        if (length > 0) {
          avgNormal = [
            normalSum[0] / length,
            normalSum[1] / length,
            normalSum[2] / length
          ];
        }
      }
      setData.bounds = {
        min: setMin,
        max: setMax,
        center: setCenter,
        size: setSize,
        diagonal: setDiagonal,
        suggestedEye: suggestedEye,
        translationToCenter: translationToCenter,
        avgNormal: avgNormal
      };
      for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
        totalTriangles++;
        indexArray.push(
          inputTriangles[whichSet].triangles[whichSetTri][0] + indexOffset,
          inputTriangles[whichSet].triangles[whichSetTri][1] + indexOffset,
          inputTriangles[whichSet].triangles[whichSetTri][2] + indexOffset
        );
      }
      indexOffset += inputTriangles[whichSet].vertices.length;
      setData.endIdx = totalTriangles * 3;
      setData.avgPos = avgPos;
      modelMat.push(mat4.create());
      TriangleSetInfo.push(setData);
      var setIdx = TriangleSetInfo.length - 1;

      if (setData.texture === "cat.png") {
        catSetIndices.push(setIdx);
        var defaultTranslation = [0.0755, 0.0247, -0.0138];
        var defaultScale = 1.2;
        var defaultAxes = {
          right: [-0.8957, 0.0552, 0.4412],
          up: [-0.4371, 0.0730, -0.8964],
          forward: [-0.0817, -0.9958, -0.0413]
        };
        var mat = modelMat[setIdx];
        mat[0] = defaultAxes.right[0] * defaultScale;
        mat[1] = defaultAxes.right[1] * defaultScale;
        mat[2] = defaultAxes.right[2] * defaultScale;
        mat[3] = 0;
        mat[4] = defaultAxes.up[0] * defaultScale;
        mat[5] = defaultAxes.up[1] * defaultScale;
        mat[6] = defaultAxes.up[2] * defaultScale;
        mat[7] = 0;
        mat[8] = defaultAxes.forward[0] * defaultScale;
        mat[9] = defaultAxes.forward[1] * defaultScale;
        mat[10] = defaultAxes.forward[2] * defaultScale;
        mat[11] = 0;
        mat[12] = defaultTranslation[0];
        mat[13] = defaultTranslation[1];
        mat[14] = defaultTranslation[2];
        mat[15] = 1;
        var cloneOffsets = [
          [0.45, 0.35, 0.0],
          [-0.82, -0.72, 0.20],
          [1.08, 0.68, 0.28],
          [-1.18, 0.82, 0.24]
        ];
        catCloneOffsets[setIdx] = cloneOffsets;
        console.log("[Object set " + setIdx + "] Default transform applied", {
          texture: setData.texture,
          translation: formatVec(defaultTranslation),
          scale: [defaultScale, defaultScale, defaultScale],
          axes: {
            right: formatVec(defaultAxes.right),
            up: formatVec(defaultAxes.up),
            forward: formatVec(defaultAxes.forward)
          }
        });
      }

      opaqueSetIndices.push(setIdx);
      diagnosticSets.push({
        index: whichSet,
        texture: inputTriangles[whichSet].material.texture,
        bounds: setData.bounds
      });
    }
    if (diagnosticSets.length > 0) {
      var sceneCenter = [
        (sceneMin[0] + sceneMax[0]) / 2,
        (sceneMin[1] + sceneMax[1]) / 2,
        (sceneMin[2] + sceneMax[2]) / 2
      ];
      var sceneSize = [
        sceneMax[0] - sceneMin[0],
        sceneMax[1] - sceneMin[1],
        sceneMax[2] - sceneMin[2]
      ];
      var sceneDiagonal = Math.hypot(sceneSize[0], sceneSize[1], sceneSize[2]);
      var fovRadians = Math.PI / 2;
      var radius = sceneDiagonal * 0.5;
      var cameraDistance = radius > 0 ? radius / Math.tan(fovRadians / 2) : 1.0;
      var suggestedSceneEye = [
        sceneCenter[0],
        sceneCenter[1],
        sceneCenter[2] - cameraDistance
      ];
      var translationToCenter = [
        -sceneCenter[0],
        -sceneCenter[1],
        -sceneCenter[2]
      ];
      console.groupCollapsed("Scene diagnostics");
      console.log("Scene bounds (WebGL):", {
        min: sceneMin,
        max: sceneMax,
        size: sceneSize
      });
      console.log("Scene center (camera target):", sceneCenter);
      console.log("Suggested translation to center at origin:", translationToCenter);
      console.log("Suggested camera eye (look towards +Z):", suggestedSceneEye);
      diagnosticSets.forEach(function(setInfo) {
        var b = setInfo.bounds;
        console.group("Set " + setInfo.index + " diagnostics");
        console.log("Texture:", setInfo.texture);
        console.log("Bounds:", b);
        console.log("Suggested translation:", b.translationToCenter);
        console.log("Suggested camera eye:", b.suggestedEye);
        if (b.avgNormal) {
          console.log("Average normal:", b.avgNormal);
          if (b.avgNormal[1] < 0) {
            console.log("Note: average normal points downward; consider rotating 180° about X.");
          }
        }
        console.groupEnd();
      });
      console.groupEnd();
    }
    vertexBuffer = gl.createBuffer();
    indexBuffer = gl.createBuffer();
    uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvArray), gl.STATIC_DRAW);
    var texturePromises = [];
    for(var textureId=0; textureId<textureNameArray.length; textureId++) {
      texturePromises.push(getTextureImage(textureNameArray[textureId]));
    }
    Promise.all(texturePromises).then(function(loadedTextures) {
      for(var i=0; i<loadedTextures.length; i++) {
        textureArray.push(loadedTextures[i]);
      }
    }).catch(function(error) {
      console.error("Error loading textures:", error);
    });
  }
}

function setupShaders() {

  var fShaderCode = `
    precision mediump float;

    uniform sampler2D uTexture;

    varying vec2 vUV;
    varying float vAlpha;

    void main(void) {
      vec4 textureColor = texture2D(uTexture, vUV);
      gl_FragColor = vec4(textureColor.rgb, vAlpha);
    }
  `;

  var vShaderCode = `
    attribute vec3 vertexPosition;
    attribute vec2 vertexUV;

    uniform mat4 modelMat;
    uniform mat4 viewMat;
    uniform mat4 projectionMat;

    varying vec2 vUV;
    varying float vAlpha;

    void main(void) {
      vUV = vec2(1.0 - vertexUV.x, 1.0 - vertexUV.y);
      vAlpha = 1.0;
      gl_Position = projectionMat * viewMat * modelMat * vec4(vertexPosition, 1.0);
    }
  `;

  try {
    var fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fShaderCode);
    gl.compileShader(fShader);

    var vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vShaderCode);
    gl.compileShader(vShader);

    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
      gl.deleteShader(fShader);
    } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
      gl.deleteShader(vShader);
    } else {
      var shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, fShader);
      gl.attachShader(shaderProgram, vShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
      } else {
        gl.useProgram(shaderProgram);
        vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
        gl.enableVertexAttribArray(vertexPositionAttrib);
        vertexUVAttrib = gl.getAttribLocation(shaderProgram, "vertexUV");
        gl.enableVertexAttribArray(vertexUVAttrib);
        viewMatUniform = gl.getUniformLocation(shaderProgram, "viewMat");
        projectionMatUniform = gl.getUniformLocation(shaderProgram, "projectionMat");
        modelMatUniform = gl.getUniformLocation(shaderProgram, "modelMat");
        textureUniform = gl.getUniformLocation(shaderProgram, "uTexture");
      }
    }
  }

  catch (e) {
    console.log(e);
  }
  altPosition = false;
  setTimeout(function alterPosition() {
    altPosition = !altPosition;
    setTimeout(alterPosition, 2000);
  }, 2000);
}

function renderTriangles() {
  gl.clearColor(0.0, 0.4, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  requestAnimationFrame(renderTriangles);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.vertexAttribPointer(vertexUVAttrib, 2, gl.FLOAT, false, 0, 0);

  viewMat = mat4.create();
  mat4.lookAt(viewMat, Eye, Target, ViewUp);
  var canvas = document.getElementById("myWebGLCanvas");
  var aspectRatio = canvas.width / canvas.height;
  projectionMat = mat4.create();
  mat4.perspective(projectionMat, Math.PI / 2, aspectRatio, 0.01, 100);
  gl.uniformMatrix4fv(viewMatUniform, false, viewMat);
  gl.uniformMatrix4fv(projectionMatUniform, false, projectionMat);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.uniform1i(textureUniform, 0);

  if (catSpinAnimation) {
    var now = performance.now();
    var elapsed = now - catSpinAnimation.startTime;
    var clamped = Math.min(Math.max(elapsed, 0), catSpinAnimation.duration);
    var progress = catSpinAnimation.duration > 0 ? clamped / catSpinAnimation.duration : 1;
    var targetAngle = catSpinAnimation.totalAngle * progress;
    var deltaAngle = targetAngle - catSpinAnimation.lastAngle;
    if (deltaAngle !== 0) {
      for (var s = 0; s < catSetIndices.length; s++) {
        rotate(deltaAngle, catSpinAxis, catSetIndices[s]);
      }
      catSpinAnimation.lastAngle = targetAngle;
    }
    var hoverPhase = progress * Math.PI * 2 * catSpinAnimation.hoverCycles;
    var hoverOffset = catSpinAnimation.hoverAmplitude * Math.sin(hoverPhase);
    for (var h = 0; h < catSetIndices.length; h++) {
      var setIndex = catSetIndices[h];
      var baseTranslation = catSpinAnimation.baseTranslations[setIndex];
      if (baseTranslation) {
        modelMat[setIndex][12] = baseTranslation[0];
        modelMat[setIndex][13] = baseTranslation[1] + hoverOffset;
        modelMat[setIndex][14] = baseTranslation[2];
      }
    }
    if (progress >= 1) {
      for (var r = 0; r < catSetIndices.length; r++) {
        var idx = catSetIndices[r];
        var base = catSpinAnimation.baseTranslations[idx];
        if (base) {
          modelMat[idx][12] = base[0];
          modelMat[idx][13] = base[1];
          modelMat[idx][14] = base[2];
        }
      }
      catSpinAnimation = null;
    }
  }

  var drawTriangleSet = function(setIdx, matrixOverride) {
    gl.uniformMatrix4fv(modelMatUniform, false, matrixOverride || modelMat[setIdx]);
    if (textureArray[setIdx]) {
      gl.bindTexture(gl.TEXTURE_2D, textureArray[setIdx]);
    }
    gl.drawElements(
      gl.TRIANGLES,
      TriangleSetInfo[setIdx].endIdx - TriangleSetInfo[setIdx].startIdx,
      gl.UNSIGNED_SHORT,
      TriangleSetInfo[setIdx].startIdx * 2
    );
  };

  var drawSetAndClones = function(setIdx) {
    drawTriangleSet(setIdx);
    if (catCloneOffsets[setIdx]) {
      for (var c = 0; c < catCloneOffsets[setIdx].length; c++) {
        var cloneMat = mat4.clone(modelMat[setIdx]);
        cloneMat[12] = modelMat[setIdx][12] + catCloneOffsets[setIdx][c][0];
        cloneMat[13] = modelMat[setIdx][13] + catCloneOffsets[setIdx][c][1];
        cloneMat[14] = modelMat[setIdx][14] + catCloneOffsets[setIdx][c][2];
        drawTriangleSet(setIdx, cloneMat);
      }
    }
  };

  gl.depthMask(true);
  for (var o = 0; o < opaqueSetIndices.length; o++) {
    drawSetAndClones(opaqueSetIndices[o]);
  }

  if (transparentSetIndices.length > 0) {
    var sortedTransparent = transparentSetIndices.slice();
    var eyeVec3 = vec3.fromValues(Eye[0], Eye[1], Eye[2]);
    sortedTransparent.sort(function(a, b) {
      var centerA = vec3.create();
      var centerB = vec3.create();
      vec3.transformMat4(centerA, vec3.fromValues(
        TriangleSetInfo[a].avgPos[0],
        TriangleSetInfo[a].avgPos[1],
        TriangleSetInfo[a].avgPos[2]
      ), modelMat[a]);
      vec3.transformMat4(centerB, vec3.fromValues(
        TriangleSetInfo[b].avgPos[0],
        TriangleSetInfo[b].avgPos[1],
        TriangleSetInfo[b].avgPos[2]
      ), modelMat[b]);
      var distA = vec3.distance(centerA, eyeVec3);
      var distB = vec3.distance(centerB, eyeVec3);
      return distB - distA;
    });

    gl.depthMask(false);
    for (var t = 0; t < sortedTransparent.length; t++) {
      drawSetAndClones(sortedTransparent[t]);
    }
    gl.depthMask(true);
  }
}

function scale(scale, setIdx) {
  translate(TriangleSetInfo[setIdx].avgPos[0], TriangleSetInfo[setIdx].avgPos[1], TriangleSetInfo[setIdx].avgPos[2], setIdx);
  mat4.scale(modelMat[setIdx], modelMat[setIdx], [scale, scale, scale]);
  translate(-TriangleSetInfo[setIdx].avgPos[0], -TriangleSetInfo[setIdx].avgPos[1], -TriangleSetInfo[setIdx].avgPos[2], setIdx);
}

function translate(tx, ty, tz, setIdx) {
  mat4.translate(modelMat[setIdx], modelMat[setIdx], [tx, ty, tz]);
}

function rotate(angle, axis, setIdx) {
  translate(TriangleSetInfo[setIdx].avgPos[0], TriangleSetInfo[setIdx].avgPos[1], TriangleSetInfo[setIdx].avgPos[2], setIdx);
  mat4.rotate(modelMat[setIdx], modelMat[setIdx], angle, axis);
  translate(-TriangleSetInfo[setIdx].avgPos[0], -TriangleSetInfo[setIdx].avgPos[1], -TriangleSetInfo[setIdx].avgPos[2], setIdx);
}

function playSpinAudio(isFast) {
  var playAudio = isFast ? fastSpinAudio : slowSpinAudio;
  var stopAudio = isFast ? slowSpinAudio : fastSpinAudio;
  if (stopAudio && stopAudio !== playAudio) {
    stopAudio.pause();
    stopAudio.currentTime = 0;
  }
  if (playAudio) {
    playAudio.currentTime = 0;
    var playPromise = playAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function(error) {
        console.warn("Audio playback prevented:", error);
      });
    }
  }
}

function startCatSpin() {
  if (catSetIndices.length === 0) {
    console.warn("No cat meshes available for spinning.");
    return;
  }
  catSpinToggleCount++;
  var fastSpin = catSpinToggleCount % 2 === 1;
  var totalRotations = fastSpin ? 11 : 2;
  var durationMs = fastSpin ? 1500 : 2000;
  var hoverAmplitude = 0.05;
  var hoverCycles = fastSpin ? 8 : 3;
  var baseTranslations = {};
  for (var b = 0; b < catSetIndices.length; b++) {
    var idx = catSetIndices[b];
    baseTranslations[idx] = [
      modelMat[idx][12],
      modelMat[idx][13],
      modelMat[idx][14]
    ];
  }
  catSpinAnimation = {
    startTime: performance.now(),
    duration: durationMs,
    totalAngle: Math.PI * 2 * totalRotations,
    lastAngle: 0,
    baseTranslations: baseTranslations,
    hoverAmplitude: hoverAmplitude,
    hoverCycles: hoverCycles
  };
  playSpinAudio(fastSpin);
}

function updateBlendModeDisplay() {
  var blendModeName = document.getElementById("blendModeName");
  var blendModeFormula = document.getElementById("blendModeFormula");

  if (!blendModeName || !blendModeFormula) return;

  blendModeName.textContent = "Texture Only";
  blendModeFormula.textContent = "Color = TextureColor (α = 1.0)";
}

function resetViewingCoordinates() {
  Eye[0] = 0.11;
  Eye[1] = 0.5;
  Eye[2] = -1.1;

  Target[0] = 0.11;
  Target[1] = 0.5;
  Target[2] = -0.6;

  ViewUp[0] = 0.0;
  ViewUp[1] = 1.0;
  ViewUp[2] = 0.0;

  var dx = Target[0] - Eye[0];
  var dy = Target[1] - Eye[1];
  var dz = Target[2] - Eye[2];
  yawAngle = Math.atan2(dx, dz);
  pitchAngle = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

  for(var i = 0; i < TriangleSetInfo.length; i++) {
    modelMat[i] = mat4.create();
  }
  selectedSet = -1;
  console.log("[Object] Model transforms reset to identity");
  logCameraState("Reset view");
}

function main() {
  var dx = Target[0] - Eye[0];
  var dy = Target[1] - Eye[1];
  var dz = Target[2] - Eye[2];
  yawAngle = Math.atan2(dx, dz);
  pitchAngle = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

  updateBlendModeDisplay();
  logCameraState("Initial state");
  fastSpinAudio = document.getElementById("oiiaFastAudio");
  slowSpinAudio = document.getElementById("oiiaSlowAudio");

  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case "a":
        Eye[0] -= 0.015;
        Target[0] -= 0.015;
        logCameraState("Translate camera -X (a)");
        break;
      case "d":
        Eye[0] += 0.015;
        Target[0] += 0.015;
        logCameraState("Translate camera +X (d)");
        break;
      case "w":
        Eye[2] += 0.015;
        Target[2] += 0.015;
        logCameraState("Translate camera +Z (w)");
        break;
      case "s":
        Eye[2] -= 0.015;
        Target[2] -= 0.015;
        logCameraState("Translate camera -Z (s)");
        break;
      case "q":
        Eye[1] += 0.015;
        Target[1] += 0.015;
        logCameraState("Translate camera +Y (q)");
        break;
      case "e":
        Eye[1] -= 0.015;
        Target[1] -= 0.015;
        logCameraState("Translate camera -Y (e)");
        break;
      case "A":
        yawAngle += 0.015;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        logCameraState("Yaw left (A)");
        break;
      case "D":
        yawAngle -= 0.015;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        logCameraState("Yaw right (D)");
        break;
      case "W":
        pitchAngle += 0.03;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        logCameraState("Pitch up (W)");
        break;
      case "S":
        pitchAngle -= 0.03;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        logCameraState("Pitch down (S)");
        break;
      case "ArrowRight":
        if (TriangleSetInfo.length === 0) break;
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
          logSelectedSetState("Deselected (ArrowRight)");
        }
        selectedSet++;
        selectedSet %= TriangleSetInfo.length;
        scale(1.2, selectedSet);
        logSelectedSetState("Selected via ArrowRight");
        break;
      case "ArrowLeft":
        if (TriangleSetInfo.length === 0) break;
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
          logSelectedSetState("Deselected (ArrowLeft)");
        }
        selectedSet--;
        if (selectedSet < 0) {
          selectedSet = TriangleSetInfo.length - 1;
        }
        scale(1.2, selectedSet);
        logSelectedSetState("Selected via ArrowLeft");
        break;
      case " ":
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
          logSelectedSetState("Deselected (space)");
        }
        selectedSet = -1;
        console.log("[Object] Selection cleared");
        break;
      case "k":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0.015, 0, 0]);
          logSelectedSetState("+X translate (k)");
        }
        break;
      case ";":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [-0.015, 0, 0]);
          logSelectedSetState("-X translate (;)");
        }
        break;
      case "o":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0, 0.015]);
          logSelectedSetState("+Z translate (o)");
        }
        break;
      case "l":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0, -0.015]);
          logSelectedSetState("-Z translate (l)");
        }
        break;
      case "i":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0.015, 0]);
          logSelectedSetState("+Y translate (i)");
        }
        break;
      case "p":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, -0.015, 0]);
          logSelectedSetState("-Y translate (p)");
        }
        break;
      case "K":
        if(selectedSet >= 0) {
          rotate(0.02, [0, 1, 0], selectedSet);
          logSelectedSetState("+Y rotate (K)");
        }
        break;
      case ":":
        if(selectedSet >= 0) {
          rotate(-0.02, [0, 1, 0], selectedSet);
          logSelectedSetState("-Y rotate (:)");
        }
        break;
      case "O":
        if(selectedSet >= 0) {
          rotate(0.02, [1, 0, 0], selectedSet);
          logSelectedSetState("+X rotate (O)");
        }
        break;
      case "L":
        if(selectedSet >= 0) {
          rotate(-0.02, [1, 0, 0], selectedSet);
          logSelectedSetState("-X rotate (L)");
        }
        break;
      case "I":
        if(selectedSet >= 0) {
          rotate(0.02, [0, 0, 1], selectedSet);
          logSelectedSetState("+Z rotate (I)");
        }
        break;
      case "P":
        if(selectedSet >= 0) {
          rotate(-0.02, [0, 0, 1], selectedSet);
          logSelectedSetState("-Z rotate (P)");
        }
        break;
      case "b":
      case "B":
        blendMode = 0;
        updateBlendModeDisplay();
        break;
      case "Escape":
        resetViewingCoordinates();
        break;
    }
  });
  setupWebGL();
  loadTriangles();
  setupShaders();
  renderTriangles();
}

