/* GLOBAL CONSTANTS AND VARIABLES */
/* assignment specificglobals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://korupttinker.github.io/prog3_csc561/triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
const INPUT_LIGHT_URL = "https://ncsucgclass.github.io/prog3/lights.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space
var ViewUp = new vec4.fromValues(0.0, 1.0, 0.0, 1.0);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var altPosition; // flag indicating whether to alter vertex positions
var vertexPositionAttrib; // where to put position for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader

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
const Target = [0.5, 0.5, 0];
const distanceFromScreen = 0.5;
var yawAngle = 0;
var pitchAngle = 0;

var selectedSet = -1;

var TriangleSetInfo = [];

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
  try {
    if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
      throw "getJSONFile: parameter not a string";
    else {
      var httpReq = new XMLHttpRequest(); // a new http request
      httpReq.open("GET", url, false); // init the request
      httpReq.send(null); // send the request
      var startTime = Date.now();
      while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now() - startTime) > 3000)
          break;
      } // until its loaded or we time out after three seconds
      if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
        throw "Unable to open " + descr + " file!";
      else
        return JSON.parse(httpReq.response);
    } // end if good params
  } // end try    

  catch (e) {
    console.log(e);
    return (String.null);
  }
} // end get input spheres

function setupWebGL() {

  // Get the canvas and context
  var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
  gl = canvas.getContext("webgl"); // get a webgl object from it

  try {
    if (gl == null) {
      throw "unable to create gl context -- is your browser gl ready?";
    } else {
      gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
      gl.clearDepth(1.0); // use max when we clear the depth buffer
      gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
    }
  } // end try

  catch (e) {
    console.log(e);
  } // end catch

} 

function loadTriangles() {
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
    for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
      // set up the vertex coord array
      var setData = {
        startIdx: totalTriangles * 3,
      };
      var avgPos = [0, 0, 0];
      for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
        coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
        colorDiffuseArray.push(inputTriangles[whichSet].material.diffuse[0], inputTriangles[whichSet].material.diffuse[1], inputTriangles[whichSet].material.diffuse[2]);
        colorAmbientArray.push(inputTriangles[whichSet].material.ambient[0], inputTriangles[whichSet].material.ambient[1], inputTriangles[whichSet].material.ambient[2]);
        colorSpecArray.push(inputTriangles[whichSet].material.specular[0], inputTriangles[whichSet].material.specular[1], inputTriangles[whichSet].material.specular[2]);
        colorNArray.push(inputTriangles[whichSet].material.n);
        colorAlphaArray.push(inputTriangles[whichSet].material.alpha);
        vertexNormalArray = vertexNormalArray.concat(inputTriangles[whichSet].normals[whichSetVert]);
        avgPos[0] += inputTriangles[whichSet].vertices[whichSetVert][0];
        avgPos[1] += inputTriangles[whichSet].vertices[whichSetVert][1];
        avgPos[2] += inputTriangles[whichSet].vertices[whichSetVert][2];
      }
      avgPos[0] /= inputTriangles[whichSet].vertices.length;
      avgPos[1] /= inputTriangles[whichSet].vertices.length;
      avgPos[2] /= inputTriangles[whichSet].vertices.length;
      for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
        totalTriangles++;
        indexArray.push(inputTriangles[whichSet].triangles[whichSetTri][0] + indexOffset, inputTriangles[whichSet].triangles[whichSetTri][1] + indexOffset, inputTriangles[whichSet].triangles[whichSetTri][2] + indexOffset);
      }
      indexOffset += inputTriangles[whichSet].vertices.length;
      setData.endIdx = totalTriangles * 3;
      setData.avgPos = avgPos;
      modelMat.push(mat4.create());
      TriangleSetInfo.push(setData);
    } 
    vertexBuffer = gl.createBuffer(); 
    indexBuffer = gl.createBuffer();
    colorDiffuseBuffer = gl.createBuffer();
    colorAmbientBuffer = gl.createBuffer();
    colorSpecBuffer = gl.createBuffer();
    colorNBuffer = gl.createBuffer();
    colorAlphaBuffer = gl.createBuffer();
    vertexNormalBuffer = gl.createBuffer();
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
  } 
} 

function loadLights() {
  // Hardcoded light values
  lightPos = [-0.5, 1.5, -0.5];
  lightDiffuse = [1.0, 1.0, 1.0];
  lightAmbient = [1.0, 1.0, 1.0];
  lightSpec = [1.0, 1.0, 1.0];
}

// setup the webGL shaders
function setupShaders() {

  // define fragment shader in essl using es6 template strings
  var fShaderCode = `
      precision mediump float;
      
      uniform vec3 lightPos; 
      uniform vec3 lightDiffuse; 
      uniform vec3 lightAmbient; 
      uniform vec3 lightSpec;
      uniform vec3 eyePosition;
      
      varying vec3 vNormal;
      varying vec3 vColorDiffuse;
      varying vec3 vColorAmbient;
      varying vec3 vColorSpec;
      varying float vColorN;
      varying float vColorAlpha;
      varying vec3 vPosition;
      void main(void) {
        // Calculate half vector
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
        gl_FragColor = vec4(finalColor, 1.0); // all fragments are white
      }
  `;

  // define vertex shader in essl using es6 template strings
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

    void main(void) {
      vColorDiffuse = vertexDiffuse;
      vColorAmbient = vertexAmbient;
      vColorSpec = vertexSpec;
      vColorN = vertexN;
      vNormal = normalize(mat3(modelMat) * vertexNormal);
      vColorAlpha = vertexAlpha;
      vPosition = (modelMat * vec4(vertexPosition, 1.0)).xyz;
      gl_Position = projectionMat * viewMat * modelMat * vec4(vertexPosition, 1.0); // use the untransformed position
    }
  `;

  try {
    // console.log("fragment shader: "+fShaderCode);
    var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
    gl.shaderSource(fShader, fShaderCode); // attach code to shader
    gl.compileShader(fShader); // compile the code for gpu execution

    // console.log("vertex shader: "+vShaderCode);
    var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
    gl.shaderSource(vShader, vShaderCode); // attach code to shader
    gl.compileShader(vShader); // compile the code for gpu execution

    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
      throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
      gl.deleteShader(fShader);
    } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
      throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
      gl.deleteShader(vShader);
    } else { // no compile errors
      var shaderProgram = gl.createProgram(); // create the single shader program
      gl.attachShader(shaderProgram, fShader); // put frag shader in program
      gl.attachShader(shaderProgram, vShader); // put vertex shader in program
      gl.linkProgram(shaderProgram); // link program into gl context

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
        throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
      } else { // no shader program link errors
        gl.useProgram(shaderProgram); // activate shader program (frag and vert)
        vertexPositionAttrib = // get pointer to vertex shader input
          gl.getAttribLocation(shaderProgram, "vertexPosition");
        gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
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

        lightPosUniform = gl.getUniformLocation(shaderProgram, "lightPos");
        lightDiffuseUniform = gl.getUniformLocation(shaderProgram, "lightDiffuse");
        lightAmbientUniform = gl.getUniformLocation(shaderProgram, "lightAmbient");
        lightSpecUniform = gl.getUniformLocation(shaderProgram, "lightSpec");
        eyePositionUniform = gl.getUniformLocation(shaderProgram, "eyePosition");
      } // end if no shader program link errors
    } // end if no compile errors
  } // end try

  catch (e) {
    console.log(e);
  } // end catch
  altPosition = false;
  setTimeout(function alterPosition() {
    altPosition = !altPosition;
    setTimeout(alterPosition, 2000);
  }, 2000); // switch flag value every 2 seconds
} // end setup shaders

// render the loaded model

function renderTriangles() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
  var bgColor = 0;
  gl.clearColor(bgColor, 0, 0, 1.0);
  requestAnimationFrame(renderTriangles);
  // vertex buffer: activate and feed into vertex shader
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed

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
  viewMat = mat4.create();
  mat4.lookAt(viewMat, Eye, Target, ViewUp);
  // Calculations for projectMat 
  projectionMat = mat4.create();
  mat4.perspective(projectionMat, Math.PI / 2, 1.0, 0.01, 100);
  // Calculations for model matrix 
  gl.uniformMatrix4fv(viewMatUniform, false, viewMat);
  gl.uniformMatrix4fv(projectionMatUniform, false, projectionMat);
  gl.uniform3fv(lightPosUniform, lightPos);
  gl.uniform3fv(lightDiffuseUniform, lightDiffuse);
  gl.uniform3fv(lightAmbientUniform, lightAmbient);
  gl.uniform3fv(lightSpecUniform, lightSpec);
  gl.uniform3fv(eyePositionUniform, [Eye[0], Eye[1], Eye[2]]);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  for (var itr = 0; itr < TriangleSetInfo.length; itr++) {
    gl.uniformMatrix4fv(modelMatUniform, false, modelMat[itr]);
    gl.drawElements(gl.TRIANGLES, TriangleSetInfo[itr].endIdx - TriangleSetInfo[itr].startIdx, gl.UNSIGNED_SHORT, TriangleSetInfo[itr].startIdx * 2);
  }
  // gl.drawElements(gl.TRIANGLES, indexArray.length, gl.UNSIGNED_SHORT, 0); // render
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

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

function main() {
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
        Target[0] = Eye[0] + Math.sin(yawAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle);
        break;
      case "D":
        yawAngle -= 0.015;
        Target[0] = Eye[0] + Math.sin(yawAngle);
        Target[2] = Eye[2] + Math.cos(yawAngle);
        break;
      case "W":
        pitchAngle += 0.03;
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(pitchAngle);
        break;
      case "S":
        pitchAngle -= 0.03;
        Target[1] = Eye[1] + Math.sin(pitchAngle);
        Target[2] = Eye[2] + Math.cos(pitchAngle);
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
      case "Escape":
        Eye[0] = 0.5;
        Eye[1] = 0.5;
        Eye[2] = -0.5;
        Target[0] = 0.5;
        Target[1] = 0.5;
        Target[2] = 0;
        pitchAngle = 0;
        yawAngle = 0;
        for(var i = 0; i < TriangleSetInfo.length; i++) {
          modelMat[i] = mat4.create();
        }
        selectedSet = -1;
        break;
    }
  });
  setupWebGL(); // set up the webGL environment
  loadLights();
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  console.log(TriangleSetInfo);
  renderTriangles(); // draw the triangles using webGL
} // end maiC