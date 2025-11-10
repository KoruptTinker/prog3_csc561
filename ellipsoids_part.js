/* GLOBAL CONSTANTS AND VARIABLES */
const WIN_Z = 0;
const WIN_LEFT = 0; const WIN_RIGHT = 1;
const WIN_BOTTOM = 0; const WIN_TOP = 1;
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog4/triangles.json";
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog4/ellipsoids.json";
const INPUT_LIGHT_URL = "https://ncsucgclass.github.io/prog3/lights.json";
const INPUT_TEXTURES_URL = "https://ncsucgclass.github.io/prog4/";

var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0);
var ViewUp = new vec4.fromValues(0.0, 1.0, 0.0, 1.0);

/* webgl globals */
var gl = null;
var vertexBuffer;
var triangleBuffer;
var triBufferSize;
var altPosition;
var vertexPositionAttrib;
var altPositionUniform;

var colorDiffuseBuffer;
var vertexDiffuseAttrib;

var colorAmbientBuffer;
var vertexAmbientAttrib;

var colorSpecBuffer;
var vertexSpecAttrib;

var colorNBuffer;
var vertexNAttrib;

var colorAlphaBuffer;
var vertexAlphaAttrib;

var lightPos;
var lightDiffuse;
var lightAmbient;
var lightSpec;

var vertexNormalBuffer;
var vertexNormalAttrib;

var lightPosUniform;
var lightDiffuseUniform;
var lightAmbientUniform;
var lightSpecUniform;

var eyePositionUniform;

var viewMat;
var viewMatUniform;

var projectionMat;
var projectionMatUniform;

var modelMat = [];
var modelMatUniform;

var indexBuffer;
var indexArray = [];

var uvBuffer;
var vertexUVAttrib;

var textureArray = [];
var textureUniform;

var blendModeUniform;
var blendMode = 0;

var opaqueSetIndices = [];
var transparentSetIndices = [];

const Target = [0.5, 0.5, 0];
const distanceFromScreen = 0.5;
var yawAngle = 0;
var pitchAngle = 0;

var selectedSet = -1;

var TriangleSetInfo = [];

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

function makeEllipsoid(currEllipsoid, numLongSteps) {
  var numLatSteps = Math.max(2, Math.floor(numLongSteps / 2));
  var vertices = [];
  var normals = [];
  var uvs = [];
  var triangles = [];

  for (var latStep = 0; latStep <= numLatSteps; latStep++) {
    var theta = Math.PI * latStep / numLatSteps;
    var sinTheta = Math.sin(theta);
    var cosTheta = Math.cos(theta);

    for (var longStep = 0; longStep <= numLongSteps; longStep++) {
      var phi = 2 * Math.PI * longStep / numLongSteps;
      var sinPhi = Math.sin(phi);
      var cosPhi = Math.cos(phi);

      var unitX = sinTheta * cosPhi;
      var unitY = cosTheta;
      var unitZ = sinTheta * sinPhi;

      vertices.push(
        currEllipsoid.x + currEllipsoid.a * unitX,
        currEllipsoid.y + currEllipsoid.b * unitY,
        currEllipsoid.z + currEllipsoid.c * unitZ
      );

      var nx = unitX / currEllipsoid.a;
      var ny = unitY / currEllipsoid.b;
      var nz = unitZ / currEllipsoid.c;
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        nx /= len;
        ny /= len;
        nz /= len;
      }
      normals.push(nx, ny, nz);

      var u = longStep / numLongSteps;
      var v = latStep / numLatSteps;
      uvs.push(u, v);
    }
  }

  var vertsPerRow = numLongSteps + 1;
  for (var lat = 0; lat < numLatSteps; lat++) {
    for (var lon = 0; lon < numLongSteps; lon++) {
      var first = lat * vertsPerRow + lon;
      var second = first + vertsPerRow;

      triangles.push(first, second, first + 1);
      triangles.push(second, second + 1, first + 1);
    }
  }

  return {
    vertices: vertices,
    normals: normals,
    uvs: uvs,
    triangles: triangles
  };
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
  selectedSet = -1;

  var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
  if (inputTriangles != String.null) {
    var whichSetVert;
    var whichSetTri;
    var coordArray = [];
    var indexOffset = 0;
    var colorDiffuseArray = [];
    var colorAmbientArray = [];
    var colorSpecArray = [];
    var colorNArray = [];
    var colorAlphaArray = [];
    var vertexNormalArray = [];
    var totalTriangles = 0;
    var uvArray = [];
    var textureNameArray = [];
    for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
      var setData = {
        startIdx: totalTriangles * 3,
        alpha: inputTriangles[whichSet].material.alpha
      };
      var avgPos = [0, 0, 0];
      textureNameArray.push(inputTriangles[whichSet].material.texture);
      for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
        coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
        colorDiffuseArray.push(
          inputTriangles[whichSet].material.diffuse[0],
          inputTriangles[whichSet].material.diffuse[1],
          inputTriangles[whichSet].material.diffuse[2]
        );
        colorAmbientArray.push(
          inputTriangles[whichSet].material.ambient[0],
          inputTriangles[whichSet].material.ambient[1],
          inputTriangles[whichSet].material.ambient[2]
        );
        colorSpecArray.push(
          inputTriangles[whichSet].material.specular[0],
          inputTriangles[whichSet].material.specular[1],
          inputTriangles[whichSet].material.specular[2]
        );
        colorNArray.push(inputTriangles[whichSet].material.n);
        colorAlphaArray.push(inputTriangles[whichSet].material.alpha);
        vertexNormalArray = vertexNormalArray.concat(inputTriangles[whichSet].normals[whichSetVert]);
        avgPos[0] += inputTriangles[whichSet].vertices[whichSetVert][0];
        avgPos[1] += inputTriangles[whichSet].vertices[whichSetVert][1];
        avgPos[2] += inputTriangles[whichSet].vertices[whichSetVert][2];
        uvArray = uvArray.concat(inputTriangles[whichSet].uvs[whichSetVert]);
      }
      avgPos[0] /= inputTriangles[whichSet].vertices.length;
      avgPos[1] /= inputTriangles[whichSet].vertices.length;
      avgPos[2] /= inputTriangles[whichSet].vertices.length;
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
      if (setData.alpha < 0.999) {
        transparentSetIndices.push(setIdx);
      } else {
        opaqueSetIndices.push(setIdx);
      }
    }
    var inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids");
    if (inputEllipsoids != String.null) {
      for (var whichEllipsoid = 0; whichEllipsoid < inputEllipsoids.length; whichEllipsoid++) {
        var ellipsoid = inputEllipsoids[whichEllipsoid];
        var ellipsoidMesh = makeEllipsoid(ellipsoid, 32);
        var setData = {
          startIdx: totalTriangles * 3,
          alpha: ellipsoid.alpha
        };

        textureNameArray.push(ellipsoid.texture);
        var vertexCount = ellipsoidMesh.vertices.length / 3;
        var ellipsoidUVs = ellipsoidMesh.uvs;

        for (var vertIdx = 0; vertIdx < vertexCount; vertIdx++) {
          var vBase = vertIdx * 3;
          var uvBase = vertIdx * 2;
          coordArray.push(
            ellipsoidMesh.vertices[vBase],
            ellipsoidMesh.vertices[vBase + 1],
            ellipsoidMesh.vertices[vBase + 2]
          );
          colorDiffuseArray.push(
            ellipsoid.diffuse[0],
            ellipsoid.diffuse[1],
            ellipsoid.diffuse[2]
          );
          colorAmbientArray.push(
            ellipsoid.ambient[0],
            ellipsoid.ambient[1],
            ellipsoid.ambient[2]
          );
          colorSpecArray.push(
            ellipsoid.specular[0],
            ellipsoid.specular[1],
            ellipsoid.specular[2]
          );
          colorNArray.push(ellipsoid.n);
          colorAlphaArray.push(ellipsoid.alpha);
          vertexNormalArray.push(
            ellipsoidMesh.normals[vBase],
            ellipsoidMesh.normals[vBase + 1],
            ellipsoidMesh.normals[vBase + 2]
          );
          uvArray.push(
            ellipsoidUVs[uvBase],
            ellipsoidUVs[uvBase + 1]
          );
        }

        for (var triIdx = 0; triIdx < ellipsoidMesh.triangles.length; triIdx += 3) {
          indexArray.push(
            ellipsoidMesh.triangles[triIdx] + indexOffset,
            ellipsoidMesh.triangles[triIdx + 1] + indexOffset,
            ellipsoidMesh.triangles[triIdx + 2] + indexOffset
          );
          totalTriangles++;
        }

        indexOffset += vertexCount;
        setData.endIdx = totalTriangles * 3;
        setData.avgPos = [ellipsoid.x, ellipsoid.y, ellipsoid.z];
        modelMat.push(mat4.create());
        TriangleSetInfo.push(setData);
        var ellipsoidSetIdx = TriangleSetInfo.length - 1;
        if (setData.alpha < 0.999) {
          transparentSetIndices.push(ellipsoidSetIdx);
        } else {
          opaqueSetIndices.push(ellipsoidSetIdx);
        }
      }
    }
    vertexBuffer = gl.createBuffer();
    indexBuffer = gl.createBuffer();
    colorDiffuseBuffer = gl.createBuffer();
    colorAmbientBuffer = gl.createBuffer();
    colorSpecBuffer = gl.createBuffer();
    colorNBuffer = gl.createBuffer();
    colorAlphaBuffer = gl.createBuffer();
    vertexNormalBuffer = gl.createBuffer();
    uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorDiffuseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorDiffuseArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorAmbientBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorAmbientArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorSpecBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorSpecArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorNBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorNArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorAlphaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorAlphaArray), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormalArray), gl.STATIC_DRAW);
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

function loadLights() {
  lightPos = [-0.5, 1.5, -0.5];
  lightDiffuse = [1.0, 1.0, 1.0];
  lightAmbient = [1.0, 1.0, 1.0];
  lightSpec = [1.0, 1.0, 1.0];
}

function setupShaders() {

  var fShaderCode = `
      precision mediump float;

      uniform vec3 lightPos;
      uniform vec3 lightDiffuse;
      uniform vec3 lightAmbient;
      uniform vec3 lightSpec;
      uniform vec3 eyePosition;

      uniform sampler2D uTexture;

      varying vec3 vNormal;
      varying vec3 vColorDiffuse;
      varying vec3 vColorAmbient;
      varying vec3 vColorSpec;
      varying float vColorN;
      varying float vColorAlpha;
      varying vec3 vPosition;

      uniform int blendMode;

      varying vec2 vUV;

      void main(void) {
        vec3 N = normalize(vNormal);
        vec3 lightVector = normalize(lightPos - vPosition);
        vec3 viewVector = normalize(eyePosition - vPosition);
        vec3 halfVector = normalize(lightVector + viewVector);
        float NL = max(dot(N, lightVector), 0.0);
        float NH = max(dot(N, halfVector), 0.0);
        vec3 ambient = lightAmbient * vColorAmbient;
        vec3 diffuse = lightDiffuse * vColorDiffuse * NL;
        float specIntensity = pow(NH, vColorN);
        vec3 spec = lightSpec * vColorSpec * specIntensity;
        vec3 finalColor = ambient + diffuse + spec;
        vec4 textureColor = texture2D(uTexture, vUV);
        if(blendMode == 1) {
          gl_FragColor = vec4(textureColor.rgb * finalColor, textureColor.a * vColorAlpha);
        } else if(blendMode == 2) {
          vec3 blendedColor = (1.0 - NL) * finalColor + NL * textureColor.rgb;
          gl_FragColor = vec4(blendedColor, textureColor.a * vColorAlpha);
        } else {
          vec4 litColor = vec4(finalColor, vColorAlpha);
          gl_FragColor = vec4(mix(litColor.rgb, textureColor.rgb, textureColor.a), textureColor.a * vColorAlpha);
        }
      }
  `;

  var vShaderCode = `
    attribute vec3 vertexPosition;
    attribute vec3 vertexDiffuse;
    attribute vec3 vertexAmbient;
    attribute vec3 vertexSpec;
    attribute float vertexN;
    attribute float vertexAlpha;
    attribute vec3 vertexNormal;

    uniform mat4 modelMat;
    uniform mat4 viewMat;
    uniform mat4 projectionMat;

    varying vec3 vNormal;
    varying vec3 vColorDiffuse;
    varying vec3 vColorAmbient;
    varying vec3 vColorSpec;
    varying float vColorN;
    varying float vColorAlpha;
    varying vec3 vPosition;

    uniform int blendMode;

    varying vec2 vUV;

    attribute vec2 vertexUV;

    void main(void) {
      vColorDiffuse = vertexDiffuse;
      vColorAmbient = vertexAmbient;
      vColorSpec = vertexSpec;
      vColorN = vertexN;
      vNormal = normalize(mat3(modelMat) * vertexNormal);
      vColorAlpha = vertexAlpha;
      vUV = vec2(1.0 - vertexUV.x, 1.0 - vertexUV.y);
      vPosition = (modelMat * vec4(vertexPosition, 1.0)).xyz;
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
        viewMatUniform = gl.getUniformLocation(shaderProgram, "viewMat");
        projectionMatUniform = gl.getUniformLocation(shaderProgram, "projectionMat");
        modelMatUniform = gl.getUniformLocation(shaderProgram, "modelMat");
        vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "vertexDiffuse");
        vertexAmbientAttrib = gl.getAttribLocation(shaderProgram, "vertexAmbient");
        vertexSpecAttrib = gl.getAttribLocation(shaderProgram, "vertexSpec");
        vertexNAttrib = gl.getAttribLocation(shaderProgram, "vertexN");
        vertexAlphaAttrib = gl.getAttribLocation(shaderProgram, "vertexAlpha");
        vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
        gl.enableVertexAttribArray(vertexDiffuseAttrib);
        gl.enableVertexAttribArray(vertexAmbientAttrib);
        gl.enableVertexAttribArray(vertexSpecAttrib);
        gl.enableVertexAttribArray(vertexNAttrib);
        gl.enableVertexAttribArray(vertexAlphaAttrib);
        gl.enableVertexAttribArray(vertexNormalAttrib);
        vertexUVAttrib = gl.getAttribLocation(shaderProgram, "vertexUV");
        gl.enableVertexAttribArray(vertexUVAttrib);

        lightPosUniform = gl.getUniformLocation(shaderProgram, "lightPos");
        lightDiffuseUniform = gl.getUniformLocation(shaderProgram, "lightDiffuse");
        lightAmbientUniform = gl.getUniformLocation(shaderProgram, "lightAmbient");
        lightSpecUniform = gl.getUniformLocation(shaderProgram, "lightSpec");
        eyePositionUniform = gl.getUniformLocation(shaderProgram, "eyePosition");
        textureUniform = gl.getUniformLocation(shaderProgram, "uTexture");
        blendModeUniform = gl.getUniformLocation(shaderProgram, "blendMode");
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
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  requestAnimationFrame(renderTriangles);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorDiffuseBuffer);
  gl.vertexAttribPointer(vertexDiffuseAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorAmbientBuffer);
  gl.vertexAttribPointer(vertexAmbientAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorSpecBuffer);
  gl.vertexAttribPointer(vertexSpecAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorNBuffer);
  gl.vertexAttribPointer(vertexNAttrib, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorAlphaBuffer);
  gl.vertexAttribPointer(vertexAlphaAttrib, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
  gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);
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
  gl.uniform3fv(lightPosUniform, lightPos);
  gl.uniform3fv(lightDiffuseUniform, lightDiffuse);
  gl.uniform3fv(lightAmbientUniform, lightAmbient);
  gl.uniform3fv(lightSpecUniform, lightSpec);
  gl.uniform3fv(eyePositionUniform, [Eye[0], Eye[1], Eye[2]]);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.uniform1i(textureUniform, 0);
  gl.uniform1i(blendModeUniform, blendMode);

  var drawTriangleSet = function(setIdx) {
    gl.uniformMatrix4fv(modelMatUniform, false, modelMat[setIdx]);
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

  gl.depthMask(true);
  for (var o = 0; o < opaqueSetIndices.length; o++) {
    drawTriangleSet(opaqueSetIndices[o]);
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
      drawTriangleSet(sortedTransparent[t]);
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

function updateBlendModeDisplay() {
  var blendModeName = document.getElementById("blendModeName");
  var blendModeFormula = document.getElementById("blendModeFormula");

  if (!blendModeName || !blendModeFormula) return;

  switch(blendMode) {
    case 0:
      blendModeName.textContent = "Alpha Blending";
      blendModeFormula.innerHTML =
        "Color = mix(LightedColor, TextureColor, αₜ)<br>αₜ = texture alpha";
      break;
    case 1:
      blendModeName.textContent = "Multiply";
      blendModeFormula.innerHTML =
        "Color = TextureColor × LightColor";
      break;
    case 2:
      blendModeName.textContent = "Fresnel-like";
      blendModeFormula.innerHTML =
        "Color = (1 - N·L) × LightColor + (N·L) × TextureColor";
      break;
    default:
      blendModeName.textContent = "Unknown Mode";
      blendModeFormula.textContent = "";
  }
}

function resetViewingCoordinates() {
  Eye[0] = 0.5;
  Eye[1] = 0.5;
  Eye[2] = -0.5;

  Target[0] = 0.5;
  Target[1] = 0.5;
  Target[2] = 0;

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
}

function main() {
  var dx = Target[0] - Eye[0];
  var dy = Target[1] - Eye[1];
  var dz = Target[2] - Eye[2];
  yawAngle = Math.atan2(dx, dz);
  pitchAngle = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

  updateBlendModeDisplay();

  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case "a":
        Eye[0] -= 0.015;
        Target[0] -= 0.015;
        break;
      case "d":
        Eye[0] += 0.015;
        Target[0] += 0.015;
        break;
      case "w":
        Eye[2] += 0.015;
        Target[2] += 0.015;
        break;
      case "s":
        Eye[2] -= 0.015;
        Target[2] -= 0.015;
        break;
      case "q":
        Eye[1] += 0.015;
        Target[1] += 0.015;
        break;
      case "e":
        Eye[1] -= 0.015;
        Target[1] -= 0.015;
        break;
      case "A":
        yawAngle += 0.015;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        break;
      case "D":
        yawAngle -= 0.015;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        break;
      case "W":
        pitchAngle += 0.03;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        break;
      case "S":
        pitchAngle -= 0.03;
        Target[0] = Eye[0] + Math.sin(yawAngle) * Math.cos(pitchAngle);
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle) * Math.cos(pitchAngle);
        break;
      case "ArrowRight":
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
        }
        selectedSet++;
        selectedSet %= TriangleSetInfo.length;
        scale(1.2, selectedSet);
        break;
      case "ArrowLeft":
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
        }
        selectedSet--;
        if (selectedSet < 0) {
          selectedSet = TriangleSetInfo.length - 1;
        }
        scale(1.2, selectedSet);
        break;
      case " ":
        if(selectedSet >= 0) {
          scale(1/1.2, selectedSet);
        }
        selectedSet = -1;
        break;
      case "k":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0.015, 0, 0]);
        }
        break;
      case ";":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [-0.015, 0, 0]);
        }
        break;
      case "o":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0, 0.015]);
        }
        break;
      case "l":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0, -0.015]);
        }
        break;
      case "i":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, 0.015, 0]);
        }
        break;
      case "p":
        if(selectedSet >= 0) {
          mat4.translate(modelMat[selectedSet], modelMat[selectedSet], [0, -0.015, 0]);
        }
        break;
      case "K":
        if(selectedSet >= 0) {
          rotate(0.02, [0, 1, 0], selectedSet);
        }
        break;
      case ":":
        if(selectedSet >= 0) {
          rotate(-0.02, [0, 1, 0], selectedSet);
        }
        break;
      case "O":
        if(selectedSet >= 0) {
          rotate(0.02, [1, 0, 0], selectedSet);
        }
        break;
      case "L":
        if(selectedSet >= 0) {
          rotate(-0.02, [1, 0, 0], selectedSet);
        }
        break;
      case "I":
        if(selectedSet >= 0) {
          rotate(0.02, [0, 0, 1], selectedSet);
        }
        break;
      case "P":
        if(selectedSet >= 0) {
          rotate(-0.02, [0, 0, 1], selectedSet);
        }
        break;
      case "b":
        blendMode = (blendMode + 1) % 3;
        updateBlendModeDisplay();
        break;
      case "B":
        blendMode = (blendMode + 2) % 3;
        updateBlendModeDisplay();
        break;
      case "Escape":
        resetViewingCoordinates();
        break;
    }
  });
  setupWebGL();
  loadLights();
  loadTriangles();
  setupShaders();
  renderTriangles();
}

