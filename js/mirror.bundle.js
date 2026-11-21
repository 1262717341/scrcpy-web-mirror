(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all2) => {
    for (var name in all2)
      __defProp(target, name, { get: all2[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/yuv-buffer/yuv-buffer.js
  var require_yuv_buffer = __commonJS({
    "node_modules/yuv-buffer/yuv-buffer.js"(exports, module) {
      var YUVBuffer = {
        /**
         * Validate a plane dimension
         * @param {number} dim - vertical or horizontal dimension
         * @throws exception on zero, negative, or non-integer value
         */
        validateDimension: function(dim) {
          if (dim <= 0 || dim !== (dim | 0)) {
            throw "YUV plane dimensions must be a positive integer";
          }
        },
        /**
         * Validate a plane offset
         * @param {number} dim - vertical or horizontal dimension
         * @throws exception on negative or non-integer value
         */
        validateOffset: function(dim) {
          if (dim < 0 || dim !== (dim | 0)) {
            throw "YUV plane offsets must be a non-negative integer";
          }
        },
        /**
         * Validate and fill out a YUVFormat object structure.
         *
         * At least width and height fields are required; other fields will be
         * derived if left missing or empty:
         * - chromaWidth and chromaHeight will be copied from width and height as for a 4:4:4 layout
         * - cropLeft and cropTop will be 0
         * - cropWidth and cropHeight will be set to whatever of the frame is visible after cropTop and cropLeft are applied
         * - displayWidth and displayHeight will be set to cropWidth and cropHeight.
         *
         * @param {YUVFormat} fields - input fields, must include width and height.
         * @returns {YUVFormat} - validated structure, with all derivable fields filled out.
         * @throws exception on invalid fields or missing width/height
         */
        format: function(fields) {
          var width = fields.width, height = fields.height, chromaWidth = fields.chromaWidth || width, chromaHeight = fields.chromaHeight || height, cropLeft = fields.cropLeft || 0, cropTop = fields.cropTop || 0, cropWidth = fields.cropWidth || width - cropLeft, cropHeight = fields.cropHeight || height - cropTop, displayWidth = fields.displayWidth || cropWidth, displayHeight = fields.displayHeight || cropHeight;
          this.validateDimension(width);
          this.validateDimension(height);
          this.validateDimension(chromaWidth);
          this.validateDimension(chromaHeight);
          this.validateOffset(cropLeft);
          this.validateOffset(cropTop);
          this.validateDimension(cropWidth);
          this.validateDimension(cropHeight);
          this.validateDimension(displayWidth);
          this.validateDimension(displayHeight);
          return {
            width,
            height,
            chromaWidth,
            chromaHeight,
            cropLeft,
            cropTop,
            cropWidth,
            cropHeight,
            displayWidth,
            displayHeight
          };
        },
        /**
         * Pick a suitable stride for a custom-allocated thingy
         * @param {number} width - width in bytes
         * @returns {number} - new width in bytes at least as large
         * @throws exception on invalid input width
         */
        suitableStride: function(width) {
          YUVBuffer.validateDimension(width);
          var alignment = 4, remainder = width % alignment;
          if (remainder == 0) {
            return width;
          } else {
            return width + (alignment - remainder);
          }
        },
        /**
         * Allocate or extract a YUVPlane object from given dimensions/source.
         * @param {number} width - width in pixels
         * @param {number} height - height in pixels
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        allocPlane: function(width, height, source, stride, offset) {
          var size, bytes;
          this.validateDimension(width);
          this.validateDimension(height);
          offset = offset || 0;
          stride = stride || this.suitableStride(width);
          this.validateDimension(stride);
          if (stride < width) {
            throw "Invalid input stride for YUV plane; must be larger than width";
          }
          size = stride * height;
          if (source) {
            if (source.length - offset < size) {
              throw "Invalid input buffer for YUV plane; must be large enough for stride times height";
            }
            bytes = source.slice(offset, offset + size);
          } else {
            bytes = new Uint8Array(size);
            stride = stride || this.suitableStride(width);
          }
          return {
            bytes,
            stride
          };
        },
        /**
         * Allocate a new YUVPlane object big enough for a luma plane in the given format
         * @param {YUVFormat} format - target frame format
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        lumaPlane: function(format, source, stride, offset) {
          return this.allocPlane(format.width, format.height, source, stride, offset);
        },
        /**
         * Allocate a new YUVPlane object big enough for a chroma plane in the given format,
         * optionally copying data from an existing buffer.
         *
         * @param {YUVFormat} format - target frame format
         * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
         * @param {number} stride - row length in bytes; optional (will create a default if missing)
         * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
         * @returns {YUVPlane} - freshly allocated planar buffer
         */
        chromaPlane: function(format, source, stride, offset) {
          return this.allocPlane(format.chromaWidth, format.chromaHeight, source, stride, offset);
        },
        /**
         * Allocate a new YUVFrame object big enough for the given format
         * @param {YUVFormat} format - target frame format
         * @param {YUVPlane} y - optional Y plane; if missing, fresh one will be allocated
         * @param {YUVPlane} u - optional U plane; if missing, fresh one will be allocated
         * @param {YUVPlane} v - optional V plane; if missing, fresh one will be allocated
         * @returns {YUVFrame} - freshly allocated frame buffer
         */
        frame: function(format, y, u, v) {
          y = y || this.lumaPlane(format);
          u = u || this.chromaPlane(format);
          v = v || this.chromaPlane(format);
          return {
            format,
            y,
            u,
            v
          };
        },
        /**
         * Duplicate a plane using new buffer memory.
         * @param {YUVPlane} plane - input plane to copy
         * @returns {YUVPlane} - freshly allocated and filled planar buffer
         */
        copyPlane: function(plane) {
          return {
            bytes: plane.bytes.slice(),
            stride: plane.stride
          };
        },
        /**
         * Duplicate a frame using new buffer memory.
         * @param {YUVFrame} frame - input frame to copyFrame
         * @returns {YUVFrame} - freshly allocated and filled frame buffer
         */
        copyFrame: function(frame) {
          return {
            format: frame.format,
            y: this.copyPlane(frame.y),
            u: this.copyPlane(frame.u),
            v: this.copyPlane(frame.v)
          };
        },
        /**
         * List the backing buffers for the frame's planes for transfer between
         * threads via Worker.postMessage.
         * @param {YUVFrame} frame - input frame
         * @returns {Array} - list of transferable objects
         */
        transferables: function(frame) {
          return [frame.y.bytes.buffer, frame.u.bytes.buffer, frame.v.bytes.buffer];
        }
      };
      module.exports = YUVBuffer;
    }
  });

  // node_modules/yuv-canvas/src/FrameSink.js
  var require_FrameSink = __commonJS({
    "node_modules/yuv-canvas/src/FrameSink.js"(exports, module) {
      (function() {
        "use strict";
        function FrameSink(canvas, options) {
          throw new Error("abstract");
        }
        FrameSink.prototype.drawFrame = function(buffer2) {
          throw new Error("abstract");
        };
        FrameSink.prototype.clear = function() {
          throw new Error("abstract");
        };
        module.exports = FrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/src/depower.js
  var require_depower = __commonJS({
    "node_modules/yuv-canvas/src/depower.js"(exports, module) {
      (function() {
        "use strict";
        function depower(ratio) {
          var shiftCount = 0, n = ratio >> 1;
          while (n != 0) {
            n = n >> 1;
            shiftCount++;
          }
          if (ratio !== 1 << shiftCount) {
            throw "chroma plane dimensions must be power of 2 ratio to luma plane dimensions; got " + ratio;
          }
          return shiftCount;
        }
        module.exports = depower;
      })();
    }
  });

  // node_modules/yuv-canvas/src/YCbCr.js
  var require_YCbCr = __commonJS({
    "node_modules/yuv-canvas/src/YCbCr.js"(exports, module) {
      (function() {
        "use strict";
        var depower = require_depower();
        function convertYCbCr(buffer2, output) {
          var width = buffer2.format.width | 0, height = buffer2.format.height | 0, hdec = depower(buffer2.format.width / buffer2.format.chromaWidth) | 0, vdec = depower(buffer2.format.height / buffer2.format.chromaHeight) | 0, bytesY = buffer2.y.bytes, bytesCb = buffer2.u.bytes, bytesCr = buffer2.v.bytes, strideY = buffer2.y.stride | 0, strideCb = buffer2.u.stride | 0, strideCr = buffer2.v.stride | 0, outStride = width << 2, YPtr = 0, Y0Ptr = 0, Y1Ptr = 0, CbPtr = 0, CrPtr = 0, outPtr = 0, outPtr0 = 0, outPtr1 = 0, colorCb = 0, colorCr = 0, multY = 0, multCrR = 0, multCbCrG = 0, multCbB = 0, x = 0, y = 0, xdec = 0, ydec = 0;
          if (hdec == 1 && vdec == 1) {
            outPtr0 = 0;
            outPtr1 = outStride;
            ydec = 0;
            for (y = 0; y < height; y += 2) {
              Y0Ptr = y * strideY | 0;
              Y1Ptr = Y0Ptr + strideY | 0;
              CbPtr = ydec * strideCb | 0;
              CrPtr = ydec * strideCr | 0;
              for (x = 0; x < width; x += 2) {
                colorCb = bytesCb[CbPtr++] | 0;
                colorCr = bytesCr[CrPtr++] | 0;
                multCrR = (409 * colorCr | 0) - 57088 | 0;
                multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
                multCbB = (516 * colorCb | 0) - 70912 | 0;
                multY = 298 * bytesY[Y0Ptr++] | 0;
                output[outPtr0] = multY + multCrR >> 8;
                output[outPtr0 + 1] = multY - multCbCrG >> 8;
                output[outPtr0 + 2] = multY + multCbB >> 8;
                outPtr0 += 4;
                multY = 298 * bytesY[Y0Ptr++] | 0;
                output[outPtr0] = multY + multCrR >> 8;
                output[outPtr0 + 1] = multY - multCbCrG >> 8;
                output[outPtr0 + 2] = multY + multCbB >> 8;
                outPtr0 += 4;
                multY = 298 * bytesY[Y1Ptr++] | 0;
                output[outPtr1] = multY + multCrR >> 8;
                output[outPtr1 + 1] = multY - multCbCrG >> 8;
                output[outPtr1 + 2] = multY + multCbB >> 8;
                outPtr1 += 4;
                multY = 298 * bytesY[Y1Ptr++] | 0;
                output[outPtr1] = multY + multCrR >> 8;
                output[outPtr1 + 1] = multY - multCbCrG >> 8;
                output[outPtr1 + 2] = multY + multCbB >> 8;
                outPtr1 += 4;
              }
              outPtr0 += outStride;
              outPtr1 += outStride;
              ydec++;
            }
          } else {
            outPtr = 0;
            for (y = 0; y < height; y++) {
              xdec = 0;
              ydec = y >> vdec;
              YPtr = y * strideY | 0;
              CbPtr = ydec * strideCb | 0;
              CrPtr = ydec * strideCr | 0;
              for (x = 0; x < width; x++) {
                xdec = x >> hdec;
                colorCb = bytesCb[CbPtr + xdec] | 0;
                colorCr = bytesCr[CrPtr + xdec] | 0;
                multCrR = (409 * colorCr | 0) - 57088 | 0;
                multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
                multCbB = (516 * colorCb | 0) - 70912 | 0;
                multY = 298 * bytesY[YPtr++] | 0;
                output[outPtr] = multY + multCrR >> 8;
                output[outPtr + 1] = multY - multCbCrG >> 8;
                output[outPtr + 2] = multY + multCbB >> 8;
                outPtr += 4;
              }
            }
          }
        }
        module.exports = {
          convertYCbCr
        };
      })();
    }
  });

  // node_modules/yuv-canvas/src/SoftwareFrameSink.js
  var require_SoftwareFrameSink = __commonJS({
    "node_modules/yuv-canvas/src/SoftwareFrameSink.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), YCbCr = require_YCbCr();
        function SoftwareFrameSink(canvas) {
          var self = this, ctx = canvas.getContext("2d"), imageData = null, resampleCanvas = null, resampleContext = null;
          function initImageData(width, height) {
            imageData = ctx.createImageData(width, height);
            var data = imageData.data, pixelCount = width * height * 4;
            for (var i = 0; i < pixelCount; i += 4) {
              data[i + 3] = 255;
            }
          }
          function initResampleCanvas(cropWidth, cropHeight) {
            resampleCanvas = document.createElement("canvas");
            resampleCanvas.width = cropWidth;
            resampleCanvas.height = cropHeight;
            resampleContext = resampleCanvas.getContext("2d");
          }
          self.drawFrame = function drawFrame(buffer2) {
            var format = buffer2.format;
            if (canvas.width !== format.displayWidth || canvas.height !== format.displayHeight) {
              canvas.width = format.displayWidth;
              canvas.height = format.displayHeight;
            }
            if (imageData === null || imageData.width != format.width || imageData.height != format.height) {
              initImageData(format.width, format.height);
            }
            YCbCr.convertYCbCr(buffer2, imageData.data);
            var resample = format.cropWidth != format.displayWidth || format.cropHeight != format.displayHeight;
            var drawContext;
            if (resample) {
              if (!resampleCanvas) {
                initResampleCanvas(format.cropWidth, format.cropHeight);
              }
              drawContext = resampleContext;
            } else {
              drawContext = ctx;
            }
            drawContext.putImageData(
              imageData,
              -format.cropLeft,
              -format.cropTop,
              // must offset the offset
              format.cropLeft,
              format.cropTop,
              format.cropWidth,
              format.cropHeight
            );
            if (resample) {
              ctx.drawImage(resampleCanvas, 0, 0, format.displayWidth, format.displayHeight);
            }
          };
          self.clear = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          };
          return self;
        }
        SoftwareFrameSink.prototype = Object.create(FrameSink.prototype);
        module.exports = SoftwareFrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/build/shaders.js
  var require_shaders = __commonJS({
    "node_modules/yuv-canvas/build/shaders.js"(exports, module) {
      module.exports = {
        vertex: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aLumaPosition;\nattribute vec2 aChromaPosition;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vLumaPosition = aLumaPosition;\n    vChromaPosition = aChromaPosition;\n}\n",
        fragment: "// inspired by https://github.com/mbebenita/Broadway/blob/master/Player/canvas.js\n\nprecision mediump float;\n\nuniform sampler2D uTextureY;\nuniform sampler2D uTextureCb;\nuniform sampler2D uTextureCr;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n   // Y, Cb, and Cr planes are uploaded as ALPHA textures.\n   float fY = texture2D(uTextureY, vLumaPosition).w;\n   float fCb = texture2D(uTextureCb, vChromaPosition).w;\n   float fCr = texture2D(uTextureCr, vChromaPosition).w;\n\n   // Premultipy the Y...\n   float fYmul = fY * 1.1643828125;\n\n   // And convert that to RGB!\n   gl_FragColor = vec4(\n     fYmul + 1.59602734375 * fCr - 0.87078515625,\n     fYmul - 0.39176171875 * fCb - 0.81296875 * fCr + 0.52959375,\n     fYmul + 2.017234375   * fCb - 1.081390625,\n     1\n   );\n}\n",
        vertexStripe: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aTexturePosition;\nvarying vec2 vTexturePosition;\n\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vTexturePosition = aTexturePosition;\n}\n",
        fragmentStripe: "// extra 'stripe' texture fiddling to work around IE 11's poor performance on gl.LUMINANCE and gl.ALPHA textures\n\nprecision mediump float;\n\nuniform sampler2D uStripe;\nuniform sampler2D uTexture;\nvarying vec2 vTexturePosition;\nvoid main() {\n   // Y, Cb, and Cr planes are mapped into a pseudo-RGBA texture\n   // so we can upload them without expanding the bytes on IE 11\n   // which doesn't allow LUMINANCE or ALPHA textures\n   // The stripe textures mark which channel to keep for each pixel.\n   // Each texture extraction will contain the relevant value in one\n   // channel only.\n\n   float fLuminance = dot(\n      texture2D(uStripe, vTexturePosition),\n      texture2D(uTexture, vTexturePosition)\n   );\n\n   gl_FragColor = vec4(0, 0, 0, fLuminance);\n}\n"
      };
    }
  });

  // node_modules/yuv-canvas/src/WebGLFrameSink.js
  var require_WebGLFrameSink = __commonJS({
    "node_modules/yuv-canvas/src/WebGLFrameSink.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), shaders = require_shaders();
        function WebGLFrameSink(canvas) {
          var self = this, gl = WebGLFrameSink.contextForCanvas(canvas), debug = false;
          if (gl === null) {
            throw new Error("WebGL unavailable");
          }
          function checkError() {
            if (debug) {
              err = gl.getError();
              if (err !== 0) {
                throw new Error("GL error " + err);
              }
            }
          }
          function compileShader(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
              var err2 = gl.getShaderInfoLog(shader);
              gl.deleteShader(shader);
              throw new Error("GL shader compilation for " + type + " failed: " + err2);
            }
            return shader;
          }
          var program, unpackProgram, err;
          var rectangle = new Float32Array([
            // First triangle (top left, clockwise)
            -1,
            -1,
            1,
            -1,
            -1,
            1,
            // Second triangle (bottom right, clockwise)
            -1,
            1,
            1,
            -1,
            1,
            1
          ]);
          var textures = {};
          var framebuffers = {};
          var stripes = {};
          var buf, positionLocation, unpackPositionLocation;
          var unpackTexturePositionBuffer, unpackTexturePositionLocation;
          var stripeLocation, unpackTextureLocation;
          var lumaPositionBuffer, lumaPositionLocation;
          var chromaPositionBuffer, chromaPositionLocation;
          function createOrReuseTexture(name, formatUpdate) {
            if (!textures[name] || formatUpdate) {
              textures[name] = gl.createTexture();
            }
            return textures[name];
          }
          function uploadTexture(name, formatUpdate, width, height, data) {
            var create = !textures[name] || formatUpdate;
            var texture = createOrReuseTexture(name, formatUpdate);
            gl.activeTexture(gl.TEXTURE0);
            if (WebGLFrameSink.stripe) {
              var uploadTemp = !textures[name + "_temp"] || formatUpdate;
              var tempTexture = createOrReuseTexture(name + "_temp", formatUpdate);
              gl.bindTexture(gl.TEXTURE_2D, tempTexture);
              if (uploadTemp) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.RGBA,
                  // internal format
                  width / 4,
                  height,
                  0,
                  // border
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  // type
                  data
                  // data!
                );
              } else {
                gl.texSubImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  0,
                  // x offset
                  0,
                  // y offset
                  width / 4,
                  height,
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  // type
                  data
                  // data!
                );
              }
              var stripeTexture = textures[name + "_stripe"];
              var uploadStripe = !stripeTexture || formatUpdate;
              if (uploadStripe) {
                stripeTexture = createOrReuseTexture(name + "_stripe", formatUpdate);
              }
              gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
              if (uploadStripe) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.RGBA,
                  // internal format
                  width,
                  1,
                  0,
                  // border
                  gl.RGBA,
                  // format
                  gl.UNSIGNED_BYTE,
                  //type
                  buildStripe(width, 1)
                  // data!
                );
              }
            } else {
              gl.bindTexture(gl.TEXTURE_2D, texture);
              if (create) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  gl.ALPHA,
                  // internal format
                  width,
                  height,
                  0,
                  // border
                  gl.ALPHA,
                  // format
                  gl.UNSIGNED_BYTE,
                  //type
                  data
                  // data!
                );
              } else {
                gl.texSubImage2D(
                  gl.TEXTURE_2D,
                  0,
                  // mip level
                  0,
                  // x
                  0,
                  // y
                  width,
                  height,
                  gl.ALPHA,
                  // internal format
                  gl.UNSIGNED_BYTE,
                  //type
                  data
                  // data!
                );
              }
            }
          }
          function unpackTexture(name, formatUpdate, width, height) {
            var texture = textures[name];
            gl.useProgram(unpackProgram);
            var fb = framebuffers[name];
            if (!fb || formatUpdate) {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, texture);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                // mip level
                gl.RGBA,
                // internal format
                width,
                height,
                0,
                // border
                gl.RGBA,
                // format
                gl.UNSIGNED_BYTE,
                //type
                null
                // data!
              );
              fb = framebuffers[name] = gl.createFramebuffer();
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            var tempTexture = textures[name + "_temp"];
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, tempTexture);
            gl.uniform1i(unpackTextureLocation, 1);
            var stripeTexture = textures[name + "_stripe"];
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
            gl.uniform1i(stripeLocation, 2);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
            gl.enableVertexAttribArray(unpackTexturePositionLocation);
            gl.vertexAttribPointer(unpackTexturePositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.viewport(0, 0, width, height);
            gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }
          function attachTexture(name, register, index) {
            gl.activeTexture(register);
            gl.bindTexture(gl.TEXTURE_2D, textures[name]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.uniform1i(gl.getUniformLocation(program, name), index);
          }
          function buildStripe(width) {
            if (stripes[width]) {
              return stripes[width];
            }
            var len = width, out = new Uint32Array(len);
            for (var i = 0; i < len; i += 4) {
              out[i] = 255;
              out[i + 1] = 65280;
              out[i + 2] = 16711680;
              out[i + 3] = 4278190080;
            }
            return stripes[width] = new Uint8Array(out.buffer);
          }
          function initProgram(vertexShaderSource, fragmentShaderSource) {
            var vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
            var program2 = gl.createProgram();
            gl.attachShader(program2, vertexShader);
            gl.attachShader(program2, fragmentShader);
            gl.linkProgram(program2);
            if (!gl.getProgramParameter(program2, gl.LINK_STATUS)) {
              var err2 = gl.getProgramInfoLog(program2);
              gl.deleteProgram(program2);
              throw new Error("GL program linking failed: " + err2);
            }
            return program2;
          }
          function init() {
            if (WebGLFrameSink.stripe) {
              unpackProgram = initProgram(shaders.vertexStripe, shaders.fragmentStripe);
              unpackPositionLocation = gl.getAttribLocation(unpackProgram, "aPosition");
              unpackTexturePositionBuffer = gl.createBuffer();
              var textureRectangle = new Float32Array([
                0,
                0,
                1,
                0,
                0,
                1,
                0,
                1,
                1,
                0,
                1,
                1
              ]);
              gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
              gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
              unpackTexturePositionLocation = gl.getAttribLocation(unpackProgram, "aTexturePosition");
              stripeLocation = gl.getUniformLocation(unpackProgram, "uStripe");
              unpackTextureLocation = gl.getUniformLocation(unpackProgram, "uTexture");
            }
            program = initProgram(shaders.vertex, shaders.fragment);
            buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, rectangle, gl.STATIC_DRAW);
            positionLocation = gl.getAttribLocation(program, "aPosition");
            lumaPositionBuffer = gl.createBuffer();
            lumaPositionLocation = gl.getAttribLocation(program, "aLumaPosition");
            chromaPositionBuffer = gl.createBuffer();
            chromaPositionLocation = gl.getAttribLocation(program, "aChromaPosition");
          }
          self.drawFrame = function(buffer2) {
            var format = buffer2.format;
            var formatUpdate = !program || canvas.width !== format.displayWidth || canvas.height !== format.displayHeight;
            if (formatUpdate) {
              canvas.width = format.displayWidth;
              canvas.height = format.displayHeight;
              self.clear();
            }
            if (!program) {
              init();
            }
            if (formatUpdate) {
              var setupTexturePosition = function(buffer3, location2, texWidth) {
                var textureX0 = format.cropLeft / texWidth;
                var textureX1 = (format.cropLeft + format.cropWidth) / texWidth;
                var textureY0 = (format.cropTop + format.cropHeight) / format.height;
                var textureY1 = format.cropTop / format.height;
                var textureRectangle = new Float32Array([
                  textureX0,
                  textureY0,
                  textureX1,
                  textureY0,
                  textureX0,
                  textureY1,
                  textureX0,
                  textureY1,
                  textureX1,
                  textureY0,
                  textureX1,
                  textureY1
                ]);
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer3);
                gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
              };
              setupTexturePosition(
                lumaPositionBuffer,
                lumaPositionLocation,
                buffer2.y.stride
              );
              setupTexturePosition(
                chromaPositionBuffer,
                chromaPositionLocation,
                buffer2.u.stride * format.width / format.chromaWidth
              );
            }
            uploadTexture("uTextureY", formatUpdate, buffer2.y.stride, format.height, buffer2.y.bytes);
            uploadTexture("uTextureCb", formatUpdate, buffer2.u.stride, format.chromaHeight, buffer2.u.bytes);
            uploadTexture("uTextureCr", formatUpdate, buffer2.v.stride, format.chromaHeight, buffer2.v.bytes);
            if (WebGLFrameSink.stripe) {
              unpackTexture("uTextureY", formatUpdate, buffer2.y.stride, format.height);
              unpackTexture("uTextureCb", formatUpdate, buffer2.u.stride, format.chromaHeight);
              unpackTexture("uTextureCr", formatUpdate, buffer2.v.stride, format.chromaHeight);
            }
            gl.useProgram(program);
            gl.viewport(0, 0, canvas.width, canvas.height);
            attachTexture("uTextureY", gl.TEXTURE0, 0);
            attachTexture("uTextureCb", gl.TEXTURE1, 1);
            attachTexture("uTextureCr", gl.TEXTURE2, 2);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, lumaPositionBuffer);
            gl.enableVertexAttribArray(lumaPositionLocation);
            gl.vertexAttribPointer(lumaPositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, chromaPositionBuffer);
            gl.enableVertexAttribArray(chromaPositionLocation);
            gl.vertexAttribPointer(chromaPositionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);
          };
          self.clear = function() {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
          };
          self.clear();
          return self;
        }
        WebGLFrameSink.stripe = false;
        WebGLFrameSink.contextForCanvas = function(canvas) {
          var options = {
            // Don't trigger discrete GPU in multi-GPU systems
            preferLowPowerToHighPerformance: true,
            powerPreference: "low-power",
            // Don't try to use software GL rendering!
            failIfMajorPerformanceCaveat: true,
            // In case we need to capture the resulting output.
            preserveDrawingBuffer: true
          };
          return canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
        };
        WebGLFrameSink.isAvailable = function() {
          var canvas = document.createElement("canvas"), gl;
          canvas.width = 1;
          canvas.height = 1;
          try {
            gl = WebGLFrameSink.contextForCanvas(canvas);
          } catch (e) {
            return false;
          }
          if (gl) {
            var register = gl.TEXTURE0, width = 4, height = 4, texture = gl.createTexture(), data = new Uint8Array(width * height), texWidth = WebGLFrameSink.stripe ? width / 4 : width, format = WebGLFrameSink.stripe ? gl.RGBA : gl.ALPHA, filter = WebGLFrameSink.stripe ? gl.NEAREST : gl.LINEAR;
            gl.activeTexture(register);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              // mip level
              format,
              // internal format
              texWidth,
              height,
              0,
              // border
              format,
              // format
              gl.UNSIGNED_BYTE,
              //type
              data
              // data!
            );
            var err = gl.getError();
            if (err) {
              return false;
            } else {
              return true;
            }
          } else {
            return false;
          }
        };
        WebGLFrameSink.prototype = Object.create(FrameSink.prototype);
        module.exports = WebGLFrameSink;
      })();
    }
  });

  // node_modules/yuv-canvas/src/yuv-canvas.js
  var require_yuv_canvas = __commonJS({
    "node_modules/yuv-canvas/src/yuv-canvas.js"(exports, module) {
      (function() {
        "use strict";
        var FrameSink = require_FrameSink(), SoftwareFrameSink = require_SoftwareFrameSink(), WebGLFrameSink = require_WebGLFrameSink();
        var YUVCanvas = {
          FrameSink,
          SoftwareFrameSink,
          WebGLFrameSink,
          /**
           * Attach a suitable FrameSink instance to an HTML5 canvas element.
           *
           * This will take over the drawing context of the canvas and may turn
           * it into a WebGL 3d canvas if possible. Do not attempt to use the
           * drawing context directly after this.
           *
           * @param {HTMLCanvasElement} canvas - HTML canvas element to attach to
           * @param {YUVCanvasOptions} options - map of options
           * @returns {FrameSink} - instance of suitable subclass.
           */
          attach: function(canvas, options) {
            options = options || {};
            var webGL = "webGL" in options ? options.webGL : WebGLFrameSink.isAvailable();
            if (webGL) {
              return new WebGLFrameSink(canvas, options);
            } else {
              return new SoftwareFrameSink(canvas, options);
            }
          }
        };
        module.exports = YUVCanvas;
      })();
    }
  });

  // node_modules/@yume-chan/async/esm/promise-resolver.js
  var PromiseResolver = class {
    #promise;
    get promise() {
      return this.#promise;
    }
    #resolve;
    #reject;
    #state = "running";
    get state() {
      return this.#state;
    }
    constructor() {
      this.#promise = new Promise((resolve, reject) => {
        this.#resolve = resolve;
        this.#reject = reject;
      });
    }
    resolve = (value) => {
      this.#resolve(value);
      this.#state = "resolved";
    };
    reject = (reason) => {
      this.#reject(reason);
      this.#state = "rejected";
    };
  };

  // node_modules/@yume-chan/async/esm/async-operation-manager.js
  var AsyncOperationManager = class {
    nextId;
    pendingResolvers = /* @__PURE__ */ new Map();
    constructor(startId = 0) {
      this.nextId = startId;
    }
    add() {
      const id = this.nextId++;
      const resolver = new PromiseResolver();
      this.pendingResolvers.set(id, resolver);
      return [id, resolver.promise];
    }
    getResolver(id) {
      if (!this.pendingResolvers.has(id)) {
        return null;
      }
      const resolver = this.pendingResolvers.get(id);
      this.pendingResolvers.delete(id);
      return resolver;
    }
    resolve(id, result) {
      const resolver = this.getResolver(id);
      if (resolver !== null) {
        resolver.resolve(result);
        return true;
      }
      return false;
    }
    reject(id, reason) {
      const resolver = this.getResolver(id);
      if (resolver !== null) {
        resolver.reject(reason);
        return true;
      }
      return false;
    }
  };

  // node_modules/@yume-chan/async/esm/delay.js
  function delay(time) {
    return new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(), time);
    });
  }

  // node_modules/@yume-chan/async/esm/maybe-promise.js
  function isPromiseLike(value) {
    return typeof value === "object" && value !== null && "then" in value;
  }

  // node_modules/@yume-chan/struct/esm/bipedal.js
  function advance(iterator, next) {
    while (true) {
      const { done, value } = iterator.next(next);
      if (done) {
        return value;
      }
      if (isPromiseLike(value)) {
        return value.then((value2) => advance(iterator, { resolved: value2 }), (error) => advance(iterator, { error }));
      }
      next = value;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function bipedal(fn, bindThis) {
    function result(...args) {
      const iterator = fn.call(this, function* (value) {
        if (isPromiseLike(value)) {
          const result2 = yield value;
          if ("resolved" in result2) {
            return result2.resolved;
          } else {
            throw result2.error;
          }
        }
        return value;
      }, ...args);
      return advance(iterator, void 0);
    }
    if (bindThis) {
      return result.bind(bindThis);
    } else {
      return result;
    }
  }

  // node_modules/@yume-chan/struct/esm/field/serialize.js
  function defaultFieldSerializer(serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        const buffer2 = serializer(source, context);
        context.buffer.set(buffer2, context.index);
        return buffer2.length;
      } else {
        return serializer(source, context);
      }
    };
  }
  function byobFieldSerializer(size, serializer) {
    return (source, context) => {
      if ("buffer" in context) {
        context.index ??= 0;
        serializer(source, context);
        return size;
      } else {
        const buffer2 = new Uint8Array(size);
        serializer(source, {
          buffer: buffer2,
          index: 0,
          littleEndian: context.littleEndian
        });
        return buffer2;
      }
    };
  }

  // node_modules/@yume-chan/struct/esm/field/factory.js
  // @__NO_SIDE_EFFECTS__
  function _field(size, type, serialize3, deserialize, options) {
    const field2 = {
      size,
      type,
      serialize: type === "default" ? defaultFieldSerializer(serialize3) : byobFieldSerializer(size, serialize3),
      deserialize: bipedal(deserialize),
      omitInit: options?.omitInit
    };
    if (options?.init) {
      field2.init = options.init;
    }
    return field2;
  }
  var field = _field;

  // node_modules/@yume-chan/struct/esm/buffer.js
  var EmptyUint8Array = new Uint8Array(0);
  function copyMaybeDifferentLength(dest, source, index, length) {
    if (source.length < length) {
      dest.set(source, index);
      dest.fill(0, index + source.length, index + length);
    } else if (source.length === length) {
      dest.set(source, index);
    } else {
      dest.set(source.subarray(0, length), index);
    }
  }
  // @__NO_SIDE_EFFECTS__
  function buffer(lengthOrField, converter) {
    if (typeof lengthOrField === "number") {
      let serialize3;
      let deserialize2;
      let init2;
      if (lengthOrField === 0) {
        serialize3 = () => {
        };
        if (converter) {
          deserialize2 = function* () {
            return converter.convert(EmptyUint8Array);
          };
        } else {
          deserialize2 = function* () {
            return EmptyUint8Array;
          };
        }
      } else {
        serialize3 = (value, { buffer: buffer2, index }) => copyMaybeDifferentLength(buffer2, value, index, lengthOrField);
        if (converter) {
          deserialize2 = function* (then, reader) {
            const array = reader.readExactly(lengthOrField);
            return converter.convert(yield* then(array));
          };
          init2 = (value) => converter.back(value);
        } else {
          deserialize2 = function* (_then, reader) {
            const array = reader.readExactly(lengthOrField);
            return array;
          };
        }
      }
      return field(lengthOrField, "byob", serialize3, deserialize2, { init: init2 });
    }
    if ((typeof lengthOrField === "object" || typeof lengthOrField === "function") && "serialize" in lengthOrField) {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return converter.convert(yield* then(array));
        };
        init2 = (value) => converter.back(value);
      } else {
        deserialize2 = function* (then, reader, context) {
          const length = yield* then(lengthOrField.deserialize(reader, context));
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return array;
        };
      }
      return field(lengthOrField.size, "default", (value, { littleEndian }) => {
        if (lengthOrField.type === "default") {
          const lengthBuffer = lengthOrField.serialize(value.length, {
            littleEndian
          });
          if (value.length === 0) {
            return lengthBuffer;
          }
          const result = new Uint8Array(lengthBuffer.length + value.length);
          result.set(lengthBuffer, 0);
          result.set(value, lengthBuffer.length);
          return result;
        } else {
          const result = new Uint8Array(lengthOrField.size + value.length);
          lengthOrField.serialize(value.length, {
            buffer: result,
            index: 0,
            littleEndian
          });
          result.set(value, lengthOrField.size);
          return result;
        }
      }, deserialize2, { init: init2 });
    }
    if (typeof lengthOrField === "string") {
      let deserialize2;
      let init2;
      if (converter) {
        deserialize2 = function* (then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return converter.convert(yield* then(array));
        };
        init2 = (value, dependencies) => {
          const array = converter.back(value);
          dependencies[lengthOrField] = array.length;
          return array;
        };
      } else {
        deserialize2 = function* (_then, reader, { dependencies }) {
          const length = dependencies[lengthOrField];
          const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
          return array;
        };
        init2 = (value, dependencies) => {
          const array = value;
          dependencies[lengthOrField] = array.length;
          return array;
        };
      }
      return field(0, "default", (source) => source, deserialize2, { init: init2 });
    }
    let deserialize;
    let init;
    if (converter) {
      deserialize = function* (then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return converter.convert(yield* then(array));
      };
      init = (value, dependencies) => {
        const array = converter.back(value);
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    } else {
      deserialize = function* (_then, reader, { dependencies }) {
        const rawLength = dependencies[lengthOrField.field];
        const length = lengthOrField.convert(rawLength);
        const array = length !== 0 ? reader.readExactly(length) : EmptyUint8Array;
        return array;
      };
      init = (value, dependencies) => {
        const array = value;
        dependencies[lengthOrField.field] = lengthOrField.back(array.length);
        return array;
      };
    }
    return field(0, "default", (source) => source, deserialize, { init });
  }

  // node_modules/@yume-chan/struct/esm/readable.js
  var ExactReadableEndedError = class extends Error {
    constructor() {
      super("ExactReadable ended");
    }
  };
  var Uint8ArrayExactReadable = class {
    #data;
    #position;
    get position() {
      return this.#position;
    }
    constructor(data) {
      this.#data = data;
      this.#position = 0;
    }
    readExactly(length) {
      if (this.#position + length > this.#data.length) {
        throw new ExactReadableEndedError();
      }
      const result = this.#data.subarray(this.#position, this.#position + length);
      this.#position += length;
      return result;
    }
  };

  // node_modules/@yume-chan/struct/esm/struct.js
  var StructDeserializeError = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var StructNotEnoughDataError = class extends StructDeserializeError {
    constructor() {
      super("The underlying readable was ended before the struct was fully deserialized");
    }
  };
  var StructEmptyError = class extends StructDeserializeError {
    constructor() {
      super("The underlying readable doesn't contain any more struct");
    }
  };
  // @__NO_SIDE_EFFECTS__
  function struct(fields, options) {
    const fieldList = Object.entries(fields);
    let size = 0;
    let byob = true;
    for (const [, field2] of fieldList) {
      size += field2.size;
      if (byob && field2.type !== "byob") {
        byob = false;
      }
    }
    const littleEndian = options.littleEndian;
    const extra = options.extra ? Object.getOwnPropertyDescriptors(options.extra) : void 0;
    return {
      littleEndian,
      fields,
      extra: options.extra,
      type: byob ? "byob" : "default",
      size,
      serialize(source, bufferOrContext) {
        const temp = { ...source };
        for (const [key, field2] of fieldList) {
          if (key in temp && "init" in field2) {
            const result = field2.init?.(temp[key], temp);
            temp[key] = result;
          }
        }
        const sizes = new Array(fieldList.length);
        const buffers = new Array(fieldList.length);
        {
          const context2 = { littleEndian };
          for (const [index2, [key, field2]] of fieldList.entries()) {
            if (field2.type === "byob") {
              sizes[index2] = field2.size;
            } else {
              buffers[index2] = field2.serialize(temp[key], context2);
              sizes[index2] = buffers[index2].length;
            }
          }
        }
        const size2 = sizes.reduce((sum, size3) => sum + size3, 0);
        let externalBuffer;
        let buffer2;
        let index;
        if (bufferOrContext instanceof Uint8Array) {
          if (bufferOrContext.length < size2) {
            throw new Error("Buffer too small");
          }
          externalBuffer = true;
          buffer2 = bufferOrContext;
          index = 0;
        } else if (typeof bufferOrContext === "object" && "buffer" in bufferOrContext) {
          externalBuffer = true;
          buffer2 = bufferOrContext.buffer;
          index = bufferOrContext.index ?? 0;
          if (buffer2.length - index < size2) {
            throw new Error("Buffer too small");
          }
        } else {
          externalBuffer = false;
          buffer2 = new Uint8Array(size2);
          index = 0;
        }
        const context = {
          buffer: buffer2,
          index,
          littleEndian
        };
        for (const [index2, [key, field2]] of fieldList.entries()) {
          if (buffers[index2]) {
            buffer2.set(buffers[index2], context.index);
          } else {
            field2.serialize(temp[key], context);
          }
          context.index += sizes[index2];
        }
        if (externalBuffer) {
          return size2;
        } else {
          return buffer2;
        }
      },
      deserialize: bipedal(function* (then, reader) {
        const startPosition = reader.position;
        const result = {};
        const context = {
          dependencies: result,
          littleEndian
        };
        try {
          for (const [key, field2] of fieldList) {
            result[key] = yield* then(field2.deserialize(reader, context));
          }
        } catch (e) {
          if (!(e instanceof ExactReadableEndedError)) {
            throw e;
          }
          if (reader.position === startPosition) {
            throw new StructEmptyError();
          } else {
            throw new StructNotEnoughDataError();
          }
        }
        if (extra) {
          Object.defineProperties(result, extra);
        }
        if (options.postDeserialize) {
          return options.postDeserialize.call(result, result);
        } else {
          return result;
        }
      })
    };
  }

  // node_modules/@yume-chan/struct/esm/extend.js
  // @__NO_SIDE_EFFECTS__
  function extend(base, fields, options) {
    return struct(Object.assign({}, base.fields, fields), {
      littleEndian: options?.littleEndian ?? base.littleEndian,
      extra: base.extra,
      postDeserialize: options?.postDeserialize
    });
  }

  // node_modules/@yume-chan/no-data-view/esm/int16.js
  // @__NO_SIDE_EFFECTS__
  function getInt16(buffer2, offset, littleEndian) {
    return littleEndian ? (buffer2[offset] | buffer2[offset + 1] << 8) << 16 >> 16 : (buffer2[offset] << 8 | buffer2[offset + 1]) << 16 >> 16;
  }
  function setInt16(buffer2, offset, value, littleEndian) {
    if (littleEndian) {
      buffer2[offset] = value;
      buffer2[offset + 1] = value >> 8;
    } else {
      buffer2[offset] = value >> 8;
      buffer2[offset + 1] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/int32.js
  // @__NO_SIDE_EFFECTS__
  function getInt32(buffer2, offset, littleEndian) {
    return littleEndian ? buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24 : buffer2[offset] << 24 | buffer2[offset + 1] << 16 | buffer2[offset + 2] << 8 | buffer2[offset + 3];
  }
  function setInt32(buffer2, offset, value, littleEndian) {
    if (littleEndian) {
      buffer2[offset] = value;
      buffer2[offset + 1] = value >> 8;
      buffer2[offset + 2] = value >> 16;
      buffer2[offset + 3] = value >> 24;
    } else {
      buffer2[offset] = value >> 24;
      buffer2[offset + 1] = value >> 16;
      buffer2[offset + 2] = value >> 8;
      buffer2[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/int64.js
  function setInt64LittleEndian(buffer2, offset, value) {
    buffer2[offset] = Number(value & 0xffn);
    buffer2[offset + 1] = Number(value >> 8n & 0xffn);
    buffer2[offset + 2] = Number(value >> 16n & 0xffn);
    buffer2[offset + 3] = Number(value >> 24n & 0xffn);
    buffer2[offset + 4] = Number(value >> 32n & 0xffn);
    buffer2[offset + 5] = Number(value >> 40n & 0xffn);
    buffer2[offset + 6] = Number(value >> 48n & 0xffn);
    buffer2[offset + 7] = Number(value >> 56n & 0xffn);
  }
  function setInt64BigEndian(buffer2, offset, value) {
    buffer2[offset] = Number(value >> 56n & 0xffn);
    buffer2[offset + 1] = Number(value >> 48n & 0xffn);
    buffer2[offset + 2] = Number(value >> 40n & 0xffn);
    buffer2[offset + 3] = Number(value >> 32n & 0xffn);
    buffer2[offset + 4] = Number(value >> 24n & 0xffn);
    buffer2[offset + 5] = Number(value >> 16n & 0xffn);
    buffer2[offset + 6] = Number(value >> 8n & 0xffn);
    buffer2[offset + 7] = Number(value & 0xffn);
  }

  // node_modules/@yume-chan/no-data-view/esm/uint16.js
  // @__NO_SIDE_EFFECTS__
  function getUint16BigEndian(buffer2, offset) {
    return buffer2[offset] << 8 | buffer2[offset + 1];
  }
  // @__NO_SIDE_EFFECTS__
  function getUint16(buffer2, offset, littleEndian) {
    return littleEndian ? buffer2[offset] | buffer2[offset + 1] << 8 : buffer2[offset + 1] | buffer2[offset] << 8;
  }
  function setUint16(buffer2, offset, value, littleEndian) {
    if (littleEndian) {
      buffer2[offset] = value;
      buffer2[offset + 1] = value >> 8;
    } else {
      buffer2[offset] = value >> 8;
      buffer2[offset + 1] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/uint32.js
  // @__NO_SIDE_EFFECTS__
  function getUint32LittleEndian(buffer2, offset) {
    return (buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24) >>> 0;
  }
  // @__NO_SIDE_EFFECTS__
  function getUint32BigEndian(buffer2, offset) {
    return (buffer2[offset] << 24 | buffer2[offset + 1] << 16 | buffer2[offset + 2] << 8 | buffer2[offset + 3]) >>> 0;
  }
  // @__NO_SIDE_EFFECTS__
  function getUint32(buffer2, offset, littleEndian) {
    return littleEndian ? (buffer2[offset] | buffer2[offset + 1] << 8 | buffer2[offset + 2] << 16 | buffer2[offset + 3] << 24) >>> 0 : (buffer2[offset] << 24 | buffer2[offset + 1] << 16 | buffer2[offset + 2] << 8 | buffer2[offset + 3]) >>> 0;
  }
  function setUint32LittleEndian(buffer2, offset, value) {
    buffer2[offset] = value;
    buffer2[offset + 1] = value >> 8;
    buffer2[offset + 2] = value >> 16;
    buffer2[offset + 3] = value >> 24;
  }
  function setUint32(buffer2, offset, value, littleEndian) {
    if (littleEndian) {
      buffer2[offset] = value;
      buffer2[offset + 1] = value >> 8;
      buffer2[offset + 2] = value >> 16;
      buffer2[offset + 3] = value >> 24;
    } else {
      buffer2[offset] = value >> 24;
      buffer2[offset + 1] = value >> 16;
      buffer2[offset + 2] = value >> 8;
      buffer2[offset + 3] = value;
    }
  }

  // node_modules/@yume-chan/no-data-view/esm/uint64.js
  function getUint64BigEndian(buffer2, offset) {
    return BigInt(buffer2[offset]) << 56n | BigInt(buffer2[offset + 1]) << 48n | BigInt(buffer2[offset + 2]) << 40n | BigInt(buffer2[offset + 3]) << 32n | BigInt(buffer2[offset + 4]) << 24n | BigInt(buffer2[offset + 5]) << 16n | BigInt(buffer2[offset + 6]) << 8n | BigInt(buffer2[offset + 7]);
  }
  function getUint64(buffer2, offset, littleEndian) {
    return littleEndian ? BigInt(buffer2[offset]) | BigInt(buffer2[offset + 1]) << 8n | BigInt(buffer2[offset + 2]) << 16n | BigInt(buffer2[offset + 3]) << 24n | BigInt(buffer2[offset + 4]) << 32n | BigInt(buffer2[offset + 5]) << 40n | BigInt(buffer2[offset + 6]) << 48n | BigInt(buffer2[offset + 7]) << 56n : BigInt(buffer2[offset]) << 56n | BigInt(buffer2[offset + 1]) << 48n | BigInt(buffer2[offset + 2]) << 40n | BigInt(buffer2[offset + 3]) << 32n | BigInt(buffer2[offset + 4]) << 24n | BigInt(buffer2[offset + 5]) << 16n | BigInt(buffer2[offset + 6]) << 8n | BigInt(buffer2[offset + 7]);
  }
  function setUint64(buffer2, offset, value, littleEndian) {
    if (littleEndian) {
      buffer2[offset] = Number(value & 0xffn);
      buffer2[offset + 1] = Number(value >> 8n & 0xffn);
      buffer2[offset + 2] = Number(value >> 16n & 0xffn);
      buffer2[offset + 3] = Number(value >> 24n & 0xffn);
      buffer2[offset + 4] = Number(value >> 32n & 0xffn);
      buffer2[offset + 5] = Number(value >> 40n & 0xffn);
      buffer2[offset + 6] = Number(value >> 48n & 0xffn);
      buffer2[offset + 7] = Number(value >> 56n & 0xffn);
    } else {
      buffer2[offset] = Number(value >> 56n & 0xffn);
      buffer2[offset + 1] = Number(value >> 48n & 0xffn);
      buffer2[offset + 2] = Number(value >> 40n & 0xffn);
      buffer2[offset + 3] = Number(value >> 32n & 0xffn);
      buffer2[offset + 4] = Number(value >> 24n & 0xffn);
      buffer2[offset + 5] = Number(value >> 16n & 0xffn);
      buffer2[offset + 6] = Number(value >> 8n & 0xffn);
      buffer2[offset + 7] = Number(value & 0xffn);
    }
  }

  // node_modules/@yume-chan/struct/esm/number.js
  // @__NO_SIDE_EFFECTS__
  function number(size, serialize3, deserialize) {
    const fn = (() => fn);
    Object.assign(fn, field(size, "byob", serialize3, deserialize));
    return fn;
  }
  var u8 = /* @__PURE__ */ number(1, (value, { buffer: buffer2, index }) => {
    buffer2[index] = value;
  }, function* (then, reader) {
    const data = yield* then(reader.readExactly(1));
    return data[0];
  });
  var u16 = /* @__PURE__ */ number(2, (value, { buffer: buffer2, index, littleEndian }) => {
    setUint16(buffer2, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    return getUint16(data, 0, littleEndian);
  });
  var u32 = /* @__PURE__ */ number(4, (value, { buffer: buffer2, index, littleEndian }) => {
    setUint32(buffer2, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getUint32(data, 0, littleEndian);
  });
  var s32 = /* @__PURE__ */ number(4, (value, { buffer: buffer2, index, littleEndian }) => {
    setInt32(buffer2, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(4));
    return getInt32(data, 0, littleEndian);
  });
  var u64 = /* @__PURE__ */ number(8, (value, { buffer: buffer2, index, littleEndian }) => {
    setUint64(buffer2, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(8));
    return getUint64(data, 0, littleEndian);
  });

  // node_modules/@yume-chan/struct/esm/utils.js
  var { TextEncoder: TextEncoder2, TextDecoder: TextDecoder2 } = globalThis;
  var SharedEncoder = /* @__PURE__ */ new TextEncoder2();
  var SharedDecoder = /* @__PURE__ */ new TextDecoder2();
  // @__NO_SIDE_EFFECTS__
  function encodeUtf8(input) {
    return SharedEncoder.encode(input);
  }
  // @__NO_SIDE_EFFECTS__
  function decodeUtf8(buffer2) {
    return SharedDecoder.decode(buffer2);
  }

  // node_modules/@yume-chan/struct/esm/string.js
  var string = (/* @__NO_SIDE_EFFECTS__ */ (lengthOrField) => {
    const field2 = buffer(lengthOrField, {
      convert: decodeUtf8,
      back: encodeUtf8
    });
    field2.as = () => field2;
    return field2;
  });

  // node_modules/@yume-chan/stream-extra/esm/stream.js
  var { AbortController: AbortController2 } = globalThis;
  var ReadableStream2 = /* @__PURE__ */ (() => {
    const { ReadableStream: ReadableStream3 } = globalThis;
    if (!ReadableStream3.from) {
      ReadableStream3.from = function(iterable) {
        const iterator = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
        return new ReadableStream3({
          async pull(controller) {
            const result = await iterator.next();
            if (result.done) {
              controller.close();
              return;
            }
            controller.enqueue(result.value);
          },
          async cancel(reason) {
            await iterator.return?.(reason);
          }
        });
      };
    }
    if (!ReadableStream3.prototype[Symbol.asyncIterator] || !ReadableStream3.prototype.values) {
      ReadableStream3.prototype.values = async function* (options) {
        const reader = this.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              return;
            }
            yield value;
          }
        } finally {
          if (!options?.preventCancel) {
            await reader.cancel();
          }
          reader.releaseLock();
        }
      };
      ReadableStream3.prototype[Symbol.asyncIterator] = // eslint-disable-next-line @typescript-eslint/unbound-method
      ReadableStream3.prototype.values;
    }
    return ReadableStream3;
  })();
  var { WritableStream, TransformStream: TransformStream2 } = globalThis;

  // node_modules/@yume-chan/stream-extra/esm/task-queue.js
  var TaskQueue = class {
    #ready;
    #disposed = false;
    enqueue(task, bail = false) {
      if (this.#disposed) {
        throw new Error("TaskQueue is disposed");
      }
      if (!this.#ready) {
        try {
          const result2 = task();
          if (isPromiseLike(result2)) {
            this.#ready = result2.then(() => {
            }, (e) => {
              if (bail) {
                throw e;
              }
            });
          }
          return result2;
        } catch (e) {
          if (bail) {
            const promise = Promise.reject(e);
            void promise.catch(() => {
            });
            this.#ready = promise;
          }
          throw e;
        }
      }
      const result = this.#ready.then(() => {
        if (this.#disposed) {
          throw new Error("TaskQueue is disposed");
        }
        return task();
      });
      this.#ready = result.then(() => {
      }, (e) => {
        if (bail || this.#disposed) {
          throw e;
        }
      });
      return result;
    }
    dispose() {
      this.#disposed = true;
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/push-readable.js
  var PushReadableStream = class extends ReadableStream2 {
    /**
     * Create a new `PushReadableStream` from a source.
     *
     * @param source If `source` returns a `Promise`, the stream will be closed
     * when the `Promise` is resolved, and be errored when the `Promise` is rejected.
     * @param strategy
     */
    constructor(source, strategy, logger) {
      let controller;
      const tasks = new TaskQueue();
      let zeroHighWaterMarkAllowEnqueue = false;
      let waterMarkLow;
      const abortController = new AbortController2();
      let stopped = false;
      const enqueue = (chunk) => {
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "start"
        });
        if (abortController.signal.aborted) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "ignored"
          });
          return false;
        }
        if (controller.desiredSize === null) {
          controller.enqueue(chunk);
          throw new Error("unreachable");
        }
        if (zeroHighWaterMarkAllowEnqueue) {
          zeroHighWaterMarkAllowEnqueue = false;
          controller.enqueue(chunk);
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "complete"
          });
          return true;
        }
        if (controller.desiredSize <= 0) {
          logger?.({
            source: "producer",
            operation: "enqueue",
            value: chunk,
            phase: "waiting"
          });
          waterMarkLow = new PromiseResolver();
          return waterMarkLow.promise.then(() => {
            controller.enqueue(chunk);
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "complete"
            });
            return true;
          }, () => {
            logger?.({
              source: "producer",
              operation: "enqueue",
              value: chunk,
              phase: "ignored"
            });
            return false;
          });
        }
        controller.enqueue(chunk);
        logger?.({
          source: "producer",
          operation: "enqueue",
          value: chunk,
          phase: "complete"
        });
        return true;
      };
      const close = (explicit) => {
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "start"
        });
        if (abortController.signal.aborted || stopped && !explicit) {
          logger?.({
            source: "producer",
            operation: "close",
            explicit,
            phase: "ignored"
          });
          return;
        }
        controller.close();
        stopped = true;
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "close",
          explicit,
          phase: "complete"
        });
      };
      const error = (error2, explicit) => {
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "start"
        });
        stopped = true;
        controller.error(error2);
        waterMarkLow?.reject();
        logger?.({
          source: "producer",
          operation: "error",
          explicit,
          phase: "complete"
        });
      };
      super({
        start: (controller_) => {
          controller = controller_;
          const result = source({
            abortSignal: abortController.signal,
            enqueue: async (chunk) => (
              // Run `enqueue`s in serial
              // Use `async/await` to always return a `Promise`
              await tasks.enqueue(() => enqueue(chunk))
            ),
            close() {
              close(true);
            },
            error(e) {
              error(e, true);
            }
          });
          if (!stopped && isPromiseLike(result)) {
            result.then(() => close(false), (e) => error(e, false));
          }
        },
        pull: () => {
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "start"
          });
          if (waterMarkLow) {
            waterMarkLow.resolve(void 0);
            waterMarkLow = void 0;
          } else if (strategy?.highWaterMark === 0) {
            zeroHighWaterMarkAllowEnqueue = true;
          }
          logger?.({
            source: "consumer",
            operation: "pull",
            phase: "complete"
          });
        },
        cancel: (reason) => {
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "start"
          });
          stopped = true;
          abortController.abort(reason);
          waterMarkLow?.reject();
          logger?.({
            source: "consumer",
            operation: "cancel",
            phase: "complete"
          });
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/try-close.js
  function tryClose(value) {
    try {
      const result = value.close();
      if (isPromiseLike(result)) {
        return result.then(() => true, () => false);
      }
      return true;
    } catch {
      return false;
    }
  }
  async function tryCancel(stream) {
    try {
      await stream.cancel();
      return true;
    } catch {
      return false;
    }
  }

  // node_modules/@yume-chan/stream-extra/esm/buffered.js
  var BufferedReadableStream = class {
    #buffered;
    // PERF: `subarray` is slow
    // don't use it until absolutely necessary
    #bufferedOffset = 0;
    #bufferedLength = 0;
    #position = 0;
    get position() {
      return this.#position;
    }
    stream;
    reader;
    constructor(stream) {
      this.stream = stream;
      this.reader = stream.getReader();
    }
    #readBuffered(length) {
      if (!this.#buffered) {
        return void 0;
      }
      const value = this.#buffered.subarray(this.#bufferedOffset, this.#bufferedOffset + length);
      if (this.#bufferedLength > length) {
        this.#position += length;
        this.#bufferedOffset += length;
        this.#bufferedLength -= length;
        return value;
      }
      this.#position += this.#bufferedLength;
      this.#buffered = void 0;
      this.#bufferedOffset = 0;
      this.#bufferedLength = 0;
      return value;
    }
    async #readSource(length) {
      const { done, value } = await this.reader.read();
      if (done) {
        throw new ExactReadableEndedError();
      }
      if (value.length > length) {
        this.#buffered = value;
        this.#bufferedOffset = length;
        this.#bufferedLength = value.length - length;
        this.#position += length;
        return value.subarray(0, length);
      }
      this.#position += value.length;
      return value;
    }
    iterateExactly(length) {
      let state = this.#buffered ? 0 : 1;
      return {
        next: () => {
          switch (state) {
            case 0: {
              const value = this.#readBuffered(length);
              if (value.length === length) {
                state = 2;
              } else {
                length -= value.length;
                state = 1;
              }
              return { done: false, value };
            }
            case 1:
              state = 3;
              return {
                done: false,
                value: this.#readSource(length).then((value) => {
                  if (value.length === length) {
                    state = 2;
                  } else {
                    length -= value.length;
                    state = 1;
                  }
                  return value;
                })
              };
            case 2:
              return { done: true, value: void 0 };
            case 3:
              throw new Error("Can't call `next` before previous Promise resolves");
            default:
              throw new Error("unreachable");
          }
        }
      };
    }
    readExactly = bipedal(function* (then, length) {
      let result;
      let index = 0;
      const initial = this.#readBuffered(length);
      if (initial) {
        if (initial.length === length) {
          return initial;
        }
        result = new Uint8Array(length);
        result.set(initial, index);
        index += initial.length;
        length -= initial.length;
      } else {
        result = new Uint8Array(length);
      }
      while (length > 0) {
        const value = yield* then(this.#readSource(length));
        result.set(value, index);
        index += value.length;
        length -= value.length;
      }
      return result;
    });
    /**
     * Return a readable stream with unconsumed data (if any) and
     * all data from the wrapped stream.
     * @returns A `ReadableStream`
     */
    release() {
      if (this.#bufferedLength > 0) {
        return new PushReadableStream(async (controller) => {
          const buffered = this.#buffered.subarray(this.#bufferedOffset);
          await controller.enqueue(buffered);
          controller.abortSignal.addEventListener("abort", () => {
            void tryCancel(this.reader);
          });
          while (true) {
            const { done, value } = await this.reader.read();
            if (done) {
              return;
            }
            await controller.enqueue(value);
          }
        });
      } else {
        this.reader.releaseLock();
        return this.stream;
      }
    }
    async cancel(reason) {
      await this.reader.cancel(reason);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/buffered-transform.js
  var BufferedTransformStream = class {
    #readable;
    get readable() {
      return this.#readable;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    constructor(transform) {
      let bufferedStreamController;
      let writableStreamController;
      const buffered = new BufferedReadableStream(new PushReadableStream((controller) => {
        bufferedStreamController = controller;
      }));
      this.#readable = new ReadableStream2({
        async pull(controller) {
          try {
            const value = await transform(buffered);
            controller.enqueue(value);
          } catch (e) {
            if (e instanceof StructEmptyError) {
              controller.close();
              return;
            }
            throw e;
          }
        },
        cancel: (reason) => {
          return writableStreamController.error(reason);
        }
      });
      this.#writable = new WritableStream({
        start(controller) {
          writableStreamController = controller;
        },
        async write(chunk) {
          await bufferedStreamController.enqueue(chunk);
        },
        abort() {
          bufferedStreamController.close();
        },
        close() {
          bufferedStreamController.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/concat.js
  var ConcatStringStream = class {
    // PERF: rope (concat strings) is faster than `[].join('')`
    #result = "";
    #resolver = new PromiseResolver();
    #writable = new WritableStream({
      write: (chunk) => {
        this.#result += chunk;
      },
      close: () => {
        this.#resolver.resolve(this.#result);
        this.#readableController.enqueue(this.#result);
        this.#readableController.close();
      },
      abort: (reason) => {
        this.#resolver.reject(reason);
        this.#readableController.error(reason);
      }
    });
    get writable() {
      return this.#writable;
    }
    #readableController;
    #readable = new ReadableStream2({
      start: (controller) => {
        this.#readableController = controller;
      }
    });
    get readable() {
      return this.#readable;
    }
    constructor() {
      void Object.defineProperties(this.#readable, {
        then: {
          get: () => this.#resolver.promise.then.bind(this.#resolver.promise)
        },
        catch: {
          get: () => this.#resolver.promise.catch.bind(this.#resolver.promise)
        },
        finally: {
          get: () => this.#resolver.promise.finally.bind(this.#resolver.promise)
        }
      });
    }
  };
  var ConcatBufferStream = class {
    #segments = [];
    #resolver = new PromiseResolver();
    #writable = new WritableStream({
      write: (chunk) => {
        this.#segments.push(chunk);
      },
      close: () => {
        let result;
        let offset = 0;
        switch (this.#segments.length) {
          case 0:
            result = EmptyUint8Array;
            break;
          case 1:
            result = this.#segments[0];
            break;
          default:
            result = new Uint8Array(this.#segments.reduce((prev, item) => prev + item.length, 0));
            for (const segment of this.#segments) {
              result.set(segment, offset);
              offset += segment.length;
            }
            break;
        }
        this.#resolver.resolve(result);
        this.#readableController.enqueue(result);
        this.#readableController.close();
      },
      abort: (reason) => {
        this.#resolver.reject(reason);
        this.#readableController.error(reason);
      }
    });
    get writable() {
      return this.#writable;
    }
    #readableController;
    #readable = new ReadableStream2({
      start: (controller) => {
        this.#readableController = controller;
      }
    });
    get readable() {
      return this.#readable;
    }
    constructor() {
      void Object.defineProperties(this.#readable, {
        then: {
          get: () => this.#resolver.promise.then.bind(this.#resolver.promise)
        },
        catch: {
          get: () => this.#resolver.promise.catch.bind(this.#resolver.promise)
        },
        finally: {
          get: () => this.#resolver.promise.finally.bind(this.#resolver.promise)
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/readable.js
  var ConsumableReadableStream = class _ConsumableReadableStream extends ReadableStream2 {
    static async enqueue(controller, chunk) {
      const output = new Consumable(chunk);
      controller.enqueue(output);
      await output.consumed;
    }
    constructor(source, strategy) {
      let wrappedController;
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk.value);
          };
        }
      }
      super({
        start(controller) {
          wrappedController = {
            enqueue(chunk) {
              return _ConsumableReadableStream.enqueue(controller, chunk);
            },
            close() {
              controller.close();
            },
            error(reason) {
              controller.error(reason);
            }
          };
          return source.start?.(wrappedController);
        },
        pull() {
          return source.pull?.(wrappedController);
        },
        cancel(reason) {
          return source.cancel?.(reason);
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/wrap-byte-readable.js
  var ConsumableWrapByteReadableStream = class extends ReadableStream2 {
    constructor(stream, chunkSize, min) {
      const reader = stream.getReader({ mode: "byob" });
      let array = new Uint8Array(chunkSize);
      super({
        async pull(controller) {
          const { done, value } = await reader.read(array, { min });
          if (done) {
            controller.close();
            return;
          }
          await ConsumableReadableStream.enqueue(controller, value);
          array = new Uint8Array(value.buffer);
        },
        cancel(reason) {
          return reader.cancel(reason);
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/wrap-writable.js
  var ConsumableWrapWritableStream = class extends WritableStream {
    constructor(stream) {
      const writer = stream.getWriter();
      super({
        write(chunk) {
          return chunk.tryConsume((chunk2) => writer.write(chunk2));
        },
        abort(reason) {
          return writer.abort(reason);
        },
        close() {
          return writer.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/consumable/writable.js
  var ConsumableWritableStream = class extends WritableStream {
    static async write(writer, value) {
      const consumable = new Consumable(value);
      await writer.write(consumable);
      await consumable.consumed;
    }
    constructor(sink, strategy) {
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
          };
        }
      }
      super({
        start(controller) {
          return sink.start?.(controller);
        },
        write(chunk, controller) {
          return chunk.tryConsume((chunk2) => sink.write?.(chunk2, controller));
        },
        abort(reason) {
          return sink.abort?.(reason);
        },
        close() {
          return sink.close?.();
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/task.js
  var { console: console2 } = globalThis;
  var createTask = /* @__PURE__ */ (() => console2?.createTask?.bind(console2) ?? (() => ({
    run(callback) {
      return callback();
    }
  })))();

  // node_modules/@yume-chan/stream-extra/esm/consumable.js
  var Consumable = class {
    static WritableStream = ConsumableWritableStream;
    static WrapWritableStream = ConsumableWrapWritableStream;
    static ReadableStream = ConsumableReadableStream;
    static WrapByteReadableStream = ConsumableWrapByteReadableStream;
    #task;
    #resolver;
    value;
    consumed;
    constructor(value) {
      this.#task = createTask("Consumable");
      this.value = value;
      this.#resolver = new PromiseResolver();
      this.consumed = this.#resolver.promise;
    }
    consume() {
      this.#resolver.resolve();
    }
    error(error) {
      this.#resolver.reject(error);
    }
    tryConsume(callback) {
      try {
        let result = this.#task.run(() => callback(this.value));
        if (isPromiseLike(result)) {
          result = result.then((value) => {
            this.#resolver.resolve();
            return value;
          }, (e) => {
            this.#resolver.reject(e);
            throw e;
          });
        } else {
          this.#resolver.resolve();
        }
        return result;
      } catch (e) {
        this.#resolver.reject(e);
        throw e;
      }
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/index.js
  var maybe_consumable_exports = {};
  __export(maybe_consumable_exports, {
    WrapWritableStream: () => MaybeConsumableWrapWritableStream,
    WritableStream: () => MaybeConsumableWritableStream,
    getValue: () => getValue,
    tryConsume: () => tryConsume
  });

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/utils.js
  function getValue(value) {
    return value instanceof Consumable ? value.value : value;
  }
  function tryConsume(value, callback) {
    if (value instanceof Consumable) {
      return value.tryConsume(callback);
    } else {
      return callback(value);
    }
  }

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/wrap-writable.js
  var MaybeConsumableWrapWritableStream = class extends WritableStream {
    constructor(stream) {
      const writer = stream.getWriter();
      super({
        write(chunk) {
          return tryConsume(chunk, (chunk2) => writer.write(chunk2));
        },
        abort(reason) {
          return writer.abort(reason);
        },
        close() {
          return writer.close();
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/maybe-consumable/writable.js
  var MaybeConsumableWritableStream = class extends WritableStream {
    constructor(sink, strategy) {
      let wrappedStrategy;
      if (strategy) {
        wrappedStrategy = {};
        if ("highWaterMark" in strategy) {
          wrappedStrategy.highWaterMark = strategy.highWaterMark;
        }
        if ("size" in strategy) {
          wrappedStrategy.size = (chunk) => {
            return strategy.size(chunk instanceof Consumable ? chunk.value : chunk);
          };
        }
      }
      super({
        start(controller) {
          return sink.start?.(controller);
        },
        write(chunk, controller) {
          return tryConsume(chunk, (chunk2) => sink.write?.(chunk2, controller));
        },
        abort(reason) {
          return sink.abort?.(reason);
        },
        close() {
          return sink.close?.();
        }
      }, wrappedStrategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/distribution.js
  var BufferCombiner = class {
    #capacity;
    #buffer;
    #offset;
    #available;
    constructor(size) {
      this.#capacity = size;
      this.#buffer = new Uint8Array(size);
      this.#offset = 0;
      this.#available = size;
    }
    /**
     * Pushes data to the combiner.
     * @param data The input data to be split or combined.
     * @returns
     * A generator that yields buffers of specified size.
     * It may yield the same buffer multiple times, consume the data before calling `next`.
     */
    *push(data) {
      let offset = 0;
      let available = data.length;
      if (this.#offset !== 0) {
        if (available >= this.#available) {
          this.#buffer.set(data.subarray(0, this.#available), this.#offset);
          offset += this.#available;
          available -= this.#available;
          yield this.#buffer;
          this.#offset = 0;
          this.#available = this.#capacity;
          if (available === 0) {
            return;
          }
        } else {
          this.#buffer.set(data, this.#offset);
          this.#offset += available;
          this.#available -= available;
          return;
        }
      }
      while (available >= this.#capacity) {
        const end = offset + this.#capacity;
        yield data.subarray(offset, end);
        offset = end;
        available -= this.#capacity;
      }
      if (available > 0) {
        this.#buffer.set(data.subarray(offset), this.#offset);
        this.#offset += available;
        this.#available -= available;
      }
    }
    flush() {
      if (this.#offset === 0) {
        return void 0;
      }
      const output = this.#buffer.subarray(0, this.#offset);
      this.#offset = 0;
      this.#available = this.#capacity;
      return output;
    }
  };
  var DistributionStream = class extends TransformStream2 {
    constructor(size, combine = false) {
      const combiner = combine ? new BufferCombiner(size) : void 0;
      super({
        async transform(chunk, controller) {
          await maybe_consumable_exports.tryConsume(chunk, async (chunk2) => {
            if (combiner) {
              for (const buffer2 of combiner.push(chunk2)) {
                await Consumable.ReadableStream.enqueue(controller, buffer2);
              }
            } else {
              let offset = 0;
              let available = chunk2.length;
              while (available > 0) {
                const end = offset + size;
                await Consumable.ReadableStream.enqueue(controller, chunk2.subarray(offset, end));
                offset = end;
                available -= size;
              }
            }
          });
        },
        flush(controller) {
          if (combiner) {
            const data = combiner.flush();
            if (data) {
              controller.enqueue(data);
            }
          }
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/wrap-readable.js
  function getWrappedReadableStream(wrapper, controller) {
    if ("start" in wrapper) {
      return wrapper.start(controller);
    } else if (typeof wrapper === "function") {
      return wrapper(controller);
    } else {
      return wrapper;
    }
  }
  var WrapReadableStream = class extends ReadableStream2 {
    readable;
    #reader;
    constructor(wrapper, strategy) {
      super({
        start: async (controller) => {
          const readable = await getWrappedReadableStream(wrapper, controller);
          this.readable = readable;
          this.#reader = this.readable.getReader();
        },
        pull: async (controller) => {
          const { done, value } = await this.#reader.read().catch((e) => {
            if ("error" in wrapper) {
              wrapper.error(e);
            }
            throw e;
          });
          if (done) {
            controller.close();
            if ("close" in wrapper) {
              await wrapper.close?.();
            }
          } else {
            controller.enqueue(value);
          }
        },
        cancel: async (reason) => {
          await this.#reader.cancel(reason);
          if ("cancel" in wrapper) {
            await wrapper.cancel?.(reason);
          }
        }
      }, strategy);
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/duplex.js
  var NOOP = () => {
  };
  var DuplexStreamFactory = class {
    #readableControllers = [];
    #writers = [];
    #writableClosed = false;
    get writableClosed() {
      return this.#writableClosed;
    }
    #closed = new PromiseResolver();
    get closed() {
      return this.#closed.promise;
    }
    #options;
    constructor(options) {
      this.#options = options ?? {};
    }
    wrapReadable(readable, strategy) {
      return new WrapReadableStream({
        start: (controller) => {
          this.#readableControllers.push(controller);
          return readable;
        },
        cancel: async () => {
          await this.close();
        },
        close: async () => {
          await this.dispose();
        }
      }, strategy);
    }
    createWritable(stream) {
      const writer = stream.getWriter();
      this.#writers.push(writer);
      return new WritableStream({
        write: async (chunk) => {
          await writer.write(chunk);
        },
        abort: async (reason) => {
          await writer.abort(reason);
          await this.close();
        },
        close: async () => {
          await writer.close().catch(NOOP);
          await this.close();
        }
      });
    }
    async close() {
      if (this.#writableClosed) {
        return;
      }
      this.#writableClosed = true;
      if (await this.#options.close?.() !== false) {
        await this.dispose();
      }
      for (const writer of this.#writers) {
        writer.close().catch(NOOP);
      }
    }
    async dispose() {
      this.#writableClosed = true;
      this.#closed.resolve();
      for (const controller of this.#readableControllers) {
        tryClose(controller);
      }
      await this.#options.dispose?.();
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/encoding.js
  var Global = globalThis;
  var TextDecoderStream = Global.TextDecoderStream;
  var TextEncoderStream = Global.TextEncoderStream;

  // node_modules/@yume-chan/stream-extra/esm/inspect.js
  var InspectStream = class extends TransformStream2 {
    constructor(callback) {
      super({
        transform(chunk, controller) {
          callback(chunk);
          controller.enqueue(chunk);
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/pipe-from.js
  function pipeFrom(writable, pair) {
    const writer = pair.writable.getWriter();
    const pipe = pair.readable.pipeTo(writable);
    return new WritableStream({
      async write(chunk) {
        await writer.write(chunk);
      },
      async close() {
        await writer.close();
        await pipe;
      }
    });
  }

  // node_modules/@yume-chan/stream-extra/esm/split-string.js
  var SplitStringStream = class extends TransformStream2 {
    constructor(separator) {
      let remaining = void 0;
      super({
        transform(chunk, controller) {
          if (remaining) {
            chunk = remaining + chunk;
            remaining = void 0;
          }
          let start = 0;
          while (start < chunk.length) {
            const index = chunk.indexOf(separator, start);
            if (index === -1) {
              remaining = chunk.substring(start);
              break;
            }
            controller.enqueue(chunk.substring(start, index));
            start = index + 1;
          }
        },
        flush(controller) {
          if (remaining) {
            controller.enqueue(remaining);
          }
        }
      });
    }
  };

  // node_modules/@yume-chan/stream-extra/esm/struct-deserialize.js
  var StructDeserializeStream = class extends BufferedTransformStream {
    constructor(struct2) {
      super((stream) => {
        return struct2.deserialize(stream);
      });
    }
  };

  // node_modules/@yume-chan/event/esm/disposable.js
  var AutoDisposable = class {
    #disposables = [];
    constructor() {
      this.dispose = this.dispose.bind(this);
    }
    addDisposable(disposable) {
      this.#disposables.push(disposable);
      return disposable;
    }
    dispose() {
      for (const disposable of this.#disposables) {
        disposable.dispose();
      }
      this.#disposables = [];
    }
  };

  // node_modules/@yume-chan/event/esm/event-emitter.js
  var EventEmitter = class {
    listeners = [];
    constructor() {
      this.event = this.event.bind(this);
    }
    addEventListener(info) {
      this.listeners.push(info);
      const remove = () => {
        const index = this.listeners.indexOf(info);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      };
      remove.dispose = remove;
      return remove;
    }
    event = (listener, thisArg, ...args) => {
      const info = {
        listener,
        thisArg,
        args
      };
      return this.addEventListener(info);
    };
    fire(e) {
      for (const info of this.listeners.slice()) {
        info.listener.call(info.thisArg, e, ...info.args);
      }
    }
    dispose() {
      this.listeners.length = 0;
    }
  };

  // node_modules/@yume-chan/event/esm/sticky-event-emitter.js
  var Undefined = /* @__PURE__ */ Symbol("undefined");
  var StickyEventEmitter = class extends EventEmitter {
    #value = Undefined;
    addEventListener(info) {
      if (this.#value !== Undefined) {
        info.listener.call(info.thisArg, this.#value, ...info.args);
      }
      return super.addEventListener(info);
    }
    fire(e) {
      this.#value = e;
      super.fire(e);
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/base.js
  var AdbServiceBase = class extends AutoDisposable {
    #adb;
    get adb() {
      return this.#adb;
    }
    constructor(adb) {
      super();
      this.#adb = adb;
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/framebuffer.js
  var Version = struct({ version: u32 }, { littleEndian: true });
  var AdbFrameBufferV1 = struct({
    bpp: u32,
    size: u32,
    width: u32,
    height: u32,
    red_offset: u32,
    red_length: u32,
    blue_offset: u32,
    blue_length: u32,
    green_offset: u32,
    green_length: u32,
    alpha_offset: u32,
    alpha_length: u32,
    data: buffer("size")
  }, { littleEndian: true });
  var AdbFrameBufferV2 = struct({
    bpp: u32,
    colorSpace: u32,
    size: u32,
    width: u32,
    height: u32,
    red_offset: u32,
    red_length: u32,
    blue_offset: u32,
    blue_length: u32,
    green_offset: u32,
    green_length: u32,
    alpha_offset: u32,
    alpha_length: u32,
    data: buffer("size")
  }, { littleEndian: true });
  var AdbFrameBufferError = class extends Error {
    constructor(message, options) {
      super(message, options);
    }
  };
  var AdbFrameBufferUnsupportedVersionError = class extends AdbFrameBufferError {
    constructor(version) {
      super(`Unsupported FrameBuffer version ${version}`);
    }
  };
  var AdbFrameBufferForbiddenError = class extends AdbFrameBufferError {
    constructor() {
      super("FrameBuffer is disabled by current app");
    }
  };
  async function framebuffer(adb) {
    const socket = await adb.createSocket("framebuffer:");
    const stream = new BufferedReadableStream(socket.readable);
    let version;
    try {
      ({ version } = await Version.deserialize(stream));
    } catch (e) {
      if (e instanceof StructEmptyError) {
        throw new AdbFrameBufferForbiddenError();
      }
      throw e;
    }
    switch (version) {
      case 1:
        return await AdbFrameBufferV1.deserialize(stream);
      case 2:
        return await AdbFrameBufferV2.deserialize(stream);
      default:
        throw new AdbFrameBufferUnsupportedVersionError(version);
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/power.js
  var AdbPower = class extends AdbServiceBase {
    reboot(mode2 = "") {
      return this.adb.createSocketAndWait(`reboot:${mode2}`);
    }
    bootloader() {
      return this.reboot("bootloader");
    }
    fastboot() {
      return this.reboot("fastboot");
    }
    recovery() {
      return this.reboot("recovery");
    }
    sideload() {
      return this.reboot("sideload");
    }
    /**
     * Reboot to Qualcomm Emergency Download (EDL) Mode.
     *
     * Only works on some Qualcomm devices.
     */
    qualcommEdlMode() {
      return this.reboot("edl");
    }
    powerOff() {
      return this.adb.subprocess.noneProtocol.spawnWaitText(["reboot", "-p"]);
    }
    powerButton(longPress = false) {
      const args = ["input", "keyevent"];
      if (longPress) {
        args.push("--longpress");
      }
      args.push("POWER");
      return this.adb.subprocess.noneProtocol.spawnWaitText(args);
    }
    /**
     * Reboot to Samsung Odin download mode.
     *
     * Only works on Samsung devices.
     */
    samsungOdin() {
      return this.reboot("download");
    }
  };

  // node_modules/@yume-chan/adb/esm/utils/array-buffer.js
  function toLocalUint8Array(value) {
    if (value.buffer instanceof ArrayBuffer) {
      return value;
    }
    const copy = new Uint8Array(value.length);
    copy.set(value);
    return copy;
  }

  // node_modules/@yume-chan/adb/esm/utils/auto-reset-event.js
  var AutoResetEvent = class {
    #set;
    #queue = [];
    constructor(initialSet = false) {
      this.#set = initialSet;
    }
    wait() {
      if (!this.#set) {
        this.#set = true;
        if (this.#queue.length === 0) {
          return Promise.resolve();
        }
      }
      const resolver = new PromiseResolver();
      this.#queue.push(resolver);
      return resolver.promise;
    }
    notifyOne() {
      if (this.#queue.length !== 0) {
        this.#queue.pop().resolve();
      } else {
        this.#set = false;
      }
    }
    dispose() {
      for (const item of this.#queue) {
        item.reject(new Error("The AutoResetEvent has been disposed"));
      }
      this.#queue.length = 0;
    }
  };

  // node_modules/@yume-chan/adb/esm/utils/base64.js
  var [charToIndex, indexToChar, paddingChar] = /* @__PURE__ */ (() => {
    const charToIndex2 = [];
    const indexToChar2 = [];
    const paddingChar2 = "=".charCodeAt(0);
    function addRange(start, end) {
      const charCodeStart = start.charCodeAt(0);
      const charCodeEnd = end.charCodeAt(0);
      for (let charCode = charCodeStart; charCode <= charCodeEnd; charCode += 1) {
        charToIndex2[charCode] = indexToChar2.length;
        indexToChar2.push(charCode);
      }
    }
    addRange("A", "Z");
    addRange("a", "z");
    addRange("0", "9");
    addRange("+", "+");
    addRange("/", "/");
    return [charToIndex2, indexToChar2, paddingChar2];
  })();
  function calculateBase64EncodedLength(inputLength) {
    const remainder = inputLength % 3;
    const paddingLength = remainder !== 0 ? 3 - remainder : 0;
    return [(inputLength + paddingLength) / 3 * 4, paddingLength];
  }
  function encodeBase64(input, output) {
    const [outputLength, paddingLength] = calculateBase64EncodedLength(input.length);
    if (!output) {
      output = new Uint8Array(outputLength);
      encodeForward(input, output, paddingLength);
      return output;
    } else {
      if (output.length < outputLength) {
        throw new TypeError("output buffer is too small");
      }
      output = output.subarray(0, outputLength);
      if (input.buffer !== output.buffer) {
        encodeForward(input, output, paddingLength);
      } else if (output.byteOffset + output.length - (paddingLength + 1) <= input.byteOffset + input.length) {
        encodeForward(input, output, paddingLength);
      } else if (output.byteOffset >= input.byteOffset - 1) {
        encodeBackward(input, output, paddingLength);
      } else {
        throw new TypeError("input and output cannot overlap");
      }
      return outputLength;
    }
  }
  function encodeForward(input, output, paddingLength) {
    let inputIndex = 0;
    let outputIndex = 0;
    while (inputIndex < input.length - 2) {
      const x = input[inputIndex];
      inputIndex += 1;
      const y = input[inputIndex];
      inputIndex += 1;
      const z = input[inputIndex];
      inputIndex += 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
      outputIndex += 1;
      output[outputIndex] = indexToChar[z & 63];
      outputIndex += 1;
    }
    if (paddingLength === 2) {
      const x = input[inputIndex];
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4];
      outputIndex += 1;
      output[outputIndex] = paddingChar;
      outputIndex += 1;
      output[outputIndex] = paddingChar;
    } else if (paddingLength === 1) {
      const x = input[inputIndex];
      inputIndex += 1;
      const y = input[inputIndex];
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex += 1;
      output[outputIndex] = indexToChar[(y & 15) << 2];
      outputIndex += 1;
      output[outputIndex] = paddingChar;
    }
  }
  function encodeBackward(input, output, paddingLength) {
    let inputIndex = input.length - 1;
    let outputIndex = output.length - 1;
    if (paddingLength === 2) {
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    } else if (paddingLength === 1) {
      const y = input[inputIndex];
      inputIndex -= 1;
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = paddingChar;
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(y & 15) << 2];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    }
    while (inputIndex >= 0) {
      const z = input[inputIndex];
      inputIndex -= 1;
      const y = input[inputIndex];
      inputIndex -= 1;
      const x = input[inputIndex];
      inputIndex -= 1;
      output[outputIndex] = indexToChar[z & 63];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(y & 15) << 2 | z >> 6];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[(x & 3) << 4 | y >> 4];
      outputIndex -= 1;
      output[outputIndex] = indexToChar[x >> 2];
      outputIndex -= 1;
    }
  }

  // node_modules/@yume-chan/adb/esm/utils/hex.js
  function hexCharToNumber(char) {
    if (char < 48) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 58) {
      return char - 48;
    }
    if (char < 65) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 71) {
      return char - 55;
    }
    if (char < 97) {
      throw new TypeError(`Invalid hex char ${char}`);
    }
    if (char < 103) {
      return char - 87;
    }
    throw new TypeError(`Invalid hex char ${char}`);
  }
  function hexToNumber(data) {
    let result = 0;
    for (let i = 0; i < data.length; i += 1) {
      result = result << 4 | hexCharToNumber(data[i]);
    }
    return result;
  }

  // node_modules/@yume-chan/adb/esm/utils/no-op.js
  var NOOP2 = /* @__NO_SIDE_EFFECTS__ */ () => {
  };
  function unreachable(...args) {
    throw new Error("Unreachable. Arguments:\n" + args.join("\n"));
  }

  // node_modules/@yume-chan/adb/esm/utils/sequence-equal.js
  function sequenceEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  // node_modules/@yume-chan/adb/esm/commands/reverse.js
  var AdbReverseStringResponse = struct({
    length: string(4),
    content: string({
      field: "length",
      convert(value) {
        return Number.parseInt(value, 16);
      },
      back(value) {
        return value.toString(16).padStart(4, "0");
      }
    })
  }, { littleEndian: true });
  var AdbReverseError = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var AdbReverseNotSupportedError = class extends AdbReverseError {
    constructor() {
      super("ADB reverse tunnel is not supported on this device when connected wirelessly.");
    }
  };
  var AdbReverseErrorResponse = extend(AdbReverseStringResponse, {}, {
    postDeserialize(value) {
      if (value.content === "more than one device/emulator") {
        throw new AdbReverseNotSupportedError();
      } else {
        throw new AdbReverseError(value.content);
      }
    }
  });
  function decimalToNumber(buffer2) {
    let value = 0;
    for (const byte of buffer2) {
      if (byte < 48 || byte > 57) {
        return value;
      }
      value = value * 10 + byte - 48;
    }
    return value;
  }
  var OKAY = encodeUtf8("OKAY");
  var AdbReverseService = class extends AdbServiceBase {
    #deviceAddressToLocalAddress = /* @__PURE__ */ new Map();
    async createBufferedStream(service) {
      const socket = await this.adb.createSocket(service);
      return new BufferedReadableStream(socket.readable);
    }
    async sendRequest(service) {
      const stream = await this.createBufferedStream(service);
      const response = await stream.readExactly(4);
      if (!sequenceEqual(response, OKAY)) {
        await AdbReverseErrorResponse.deserialize(stream);
      }
      return stream;
    }
    /**
     * Get a list of all reverse port forwarding on the device.
     */
    async list() {
      const stream = await this.createBufferedStream("reverse:list-forward");
      const response = await AdbReverseStringResponse.deserialize(stream);
      return response.content.split("\n").filter((line) => !!line).map((line) => {
        const [deviceSerial, localName, remoteName] = line.split(" ");
        return { deviceSerial, localName, remoteName };
      });
    }
    /**
     * Add a reverse port forwarding for a program that already listens on a port.
     */
    async addExternal(deviceAddress, localAddress) {
      const stream = await this.sendRequest(`reverse:forward:${deviceAddress};${localAddress}`);
      if (deviceAddress.startsWith("tcp:")) {
        const position = stream.position;
        try {
          const length = hexToNumber(await stream.readExactly(4));
          const port = decimalToNumber(await stream.readExactly(length));
          deviceAddress = `tcp:${port}`;
        } catch (e) {
          if (e instanceof ExactReadableEndedError && stream.position === position) {
          } else {
            throw e;
          }
        }
      }
      return deviceAddress;
    }
    /**
     * Add a reverse port forwarding.
     */
    async add(deviceAddress, handler, localAddress) {
      localAddress = await this.adb.transport.addReverseTunnel(handler, localAddress);
      try {
        deviceAddress = await this.addExternal(deviceAddress, localAddress);
        this.#deviceAddressToLocalAddress.set(deviceAddress, localAddress);
        return deviceAddress;
      } catch (e) {
        await this.adb.transport.removeReverseTunnel(localAddress);
        throw e;
      }
    }
    /**
     * Remove a reverse port forwarding.
     */
    async remove(deviceAddress) {
      const localAddress = this.#deviceAddressToLocalAddress.get(deviceAddress);
      if (localAddress) {
        await this.adb.transport.removeReverseTunnel(localAddress);
      }
      await this.sendRequest(`reverse:killforward:${deviceAddress}`);
    }
    /**
     * Remove all reverse port forwarding, including the ones added by other programs.
     */
    async removeAll() {
      await this.adb.transport.clearReverseTunnels();
      this.#deviceAddressToLocalAddress.clear();
      await this.sendRequest(`reverse:killforward-all`);
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/process.js
  var AdbNoneProtocolProcessImpl = class {
    #socket;
    get stdin() {
      return this.#socket.writable;
    }
    get output() {
      return this.#socket.readable;
    }
    #exited;
    get exited() {
      return this.#exited;
    }
    constructor(socket, signal) {
      this.#socket = socket;
      if (signal) {
        const exited = new PromiseResolver();
        this.#socket.closed.then(() => exited.resolve(void 0), (e) => exited.reject(e));
        signal.addEventListener("abort", () => {
          exited.reject(signal.reason);
          this.#socket.close();
        });
        this.#exited = exited.promise;
      } else {
        this.#exited = this.#socket.closed;
      }
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/pty.js
  var AdbNoneProtocolPtyProcess = class {
    #socket;
    #writer;
    #input;
    get input() {
      return this.#input;
    }
    get output() {
      return this.#socket.readable;
    }
    get exited() {
      return this.#socket.closed;
    }
    constructor(socket) {
      this.#socket = socket;
      this.#writer = this.#socket.writable.getWriter();
      this.#input = new maybe_consumable_exports.WritableStream({
        write: (chunk) => this.#writer.write(chunk)
      });
    }
    sigint() {
      return this.#writer.write(new Uint8Array([3]));
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/utils.js
  function escapeArg(s) {
    let result = "";
    result += `'`;
    let base = 0;
    while (true) {
      const found = s.indexOf(`'`, base);
      if (found === -1) {
        result += s.substring(base);
        break;
      }
      result += s.substring(base, found);
      result += String.raw`'\''`;
      base = found + 1;
    }
    result += `'`;
    return result;
  }
  function splitCommand(command) {
    const result = [];
    let quote;
    let isEscaped = false;
    let start = 0;
    for (let i = 0, len = command.length; i < len; i += 1) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      const char = command.charAt(i);
      switch (char) {
        case " ":
          if (!quote && i !== start) {
            result.push(command.substring(start, i));
            start = i + 1;
          }
          break;
        case "'":
        case '"':
          if (!quote) {
            quote = char;
          } else if (char === quote) {
            quote = void 0;
          }
          break;
        case "\\":
          isEscaped = true;
          break;
      }
    }
    if (start < command.length) {
      result.push(command.substring(start));
    }
    return result;
  }

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/spawner.js
  var AdbNoneProtocolSpawner = class {
    #spawn;
    constructor(spawn) {
      this.#spawn = spawn;
    }
    spawn(command, signal) {
      signal?.throwIfAborted();
      if (typeof command === "string") {
        command = splitCommand(command);
      }
      return this.#spawn(command, signal);
    }
    async spawnWait(command) {
      const process = await this.spawn(command);
      return await process.output.pipeThrough(new ConcatBufferStream());
    }
    async spawnWaitText(command) {
      const process = await this.spawn(command);
      return await process.output.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream());
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/none/service.js
  var AdbNoneProtocolSubprocessService = class extends AdbNoneProtocolSpawner {
    #adb;
    get adb() {
      return this.#adb;
    }
    constructor(adb) {
      super(async (command, signal) => {
        const socket = await this.#adb.createSocket(`exec:${command.join(" ")}`);
        if (signal?.aborted) {
          await socket.close();
          throw signal.reason;
        }
        return new AdbNoneProtocolProcessImpl(socket, signal);
      });
      this.#adb = adb;
    }
    async pty(command) {
      if (command === void 0) {
        command = "";
      } else if (Array.isArray(command)) {
        command = command.join(" ");
      }
      return new AdbNoneProtocolPtyProcess(
        // https://github.com/microsoft/typescript/issues/17002
        await this.#adb.createSocket(`shell:${command}`)
      );
    }
  };

  // node_modules/@yume-chan/adb/esm/features.js
  var AdbFeature = {
    ShellV2: "shell_v2",
    Cmd: "cmd",
    StatV2: "stat_v2",
    ListV2: "ls_v2",
    FixedPushMkdir: "fixed_push_mkdir",
    Abb: "abb",
    AbbExec: "abb_exec",
    SendReceiveV2: "sendrecv_v2",
    DelayedAck: "delayed_ack"
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/shared.js
  var AdbShellProtocolId = {
    Stdin: 0,
    Stdout: 1,
    Stderr: 2,
    Exit: 3,
    CloseStdin: 4,
    WindowSizeChange: 5
  };
  var AdbShellProtocolPacket = struct({
    id: u8(),
    data: buffer(u32)
  }, { littleEndian: true });

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/process.js
  var AdbShellProtocolProcessImpl = class {
    #socket;
    #writer;
    #stdin;
    get stdin() {
      return this.#stdin;
    }
    #stdout;
    get stdout() {
      return this.#stdout;
    }
    #stderr;
    get stderr() {
      return this.#stderr;
    }
    #exited;
    get exited() {
      return this.#exited;
    }
    constructor(socket, signal) {
      this.#socket = socket;
      let stdoutController;
      let stderrController;
      this.#stdout = new PushReadableStream((controller) => {
        stdoutController = controller;
      });
      this.#stderr = new PushReadableStream((controller) => {
        stderrController = controller;
      });
      const exited = new PromiseResolver();
      this.#exited = exited.promise;
      socket.readable.pipeThrough(new StructDeserializeStream(AdbShellProtocolPacket)).pipeTo(new WritableStream({
        write: async (chunk) => {
          switch (chunk.id) {
            case AdbShellProtocolId.Exit:
              exited.resolve(chunk.data[0]);
              break;
            case AdbShellProtocolId.Stdout:
              await stdoutController.enqueue(chunk.data);
              break;
            case AdbShellProtocolId.Stderr:
              await stderrController.enqueue(chunk.data);
              break;
            default:
              break;
          }
        }
      })).then(() => {
        stdoutController.close();
        stderrController.close();
        exited.reject(new Error("Socket ended without exit message"));
      }, (e) => {
        stdoutController.error(e);
        stderrController.error(e);
        exited.reject(e);
      });
      if (signal) {
        signal.addEventListener("abort", () => {
          exited.reject(signal.reason);
          this.#socket.close();
        });
      }
      this.#writer = this.#socket.writable.getWriter();
      this.#stdin = new maybe_consumable_exports.WritableStream({
        write: async (chunk) => {
          await this.#writer.write(AdbShellProtocolPacket.serialize({
            id: AdbShellProtocolId.Stdin,
            data: chunk
          }));
        },
        close: () => (
          // Only shell protocol + raw mode supports closing stdin
          this.#writer.write(AdbShellProtocolPacket.serialize({
            id: AdbShellProtocolId.CloseStdin,
            data: EmptyUint8Array
          }))
        )
      });
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/pty.js
  var AdbShellProtocolPtyProcess = class {
    #socket;
    #writer;
    #input;
    get input() {
      return this.#input;
    }
    #stdout;
    get output() {
      return this.#stdout;
    }
    #exited = new PromiseResolver();
    get exited() {
      return this.#exited.promise;
    }
    constructor(socket) {
      this.#socket = socket;
      let stdoutController;
      this.#stdout = new PushReadableStream((controller) => {
        stdoutController = controller;
      });
      socket.readable.pipeThrough(new StructDeserializeStream(AdbShellProtocolPacket)).pipeTo(new WritableStream({
        write: async (chunk) => {
          switch (chunk.id) {
            case AdbShellProtocolId.Exit:
              this.#exited.resolve(chunk.data[0]);
              break;
            case AdbShellProtocolId.Stdout:
              await stdoutController.enqueue(chunk.data);
              break;
          }
        }
      })).then(() => {
        stdoutController.close();
        this.#exited.reject(new Error("Socket ended without exit message"));
      }, (e) => {
        stdoutController.error(e);
        this.#exited.reject(e);
      });
      this.#writer = this.#socket.writable.getWriter();
      this.#input = new maybe_consumable_exports.WritableStream({
        write: (chunk) => this.#writeStdin(chunk)
      });
    }
    #writeStdin(chunk) {
      return this.#writer.write(AdbShellProtocolPacket.serialize({
        id: AdbShellProtocolId.Stdin,
        data: chunk
      }));
    }
    async resize(rows, cols) {
      await this.#writer.write(AdbShellProtocolPacket.serialize({
        id: AdbShellProtocolId.WindowSizeChange,
        // The "correct" format is `${rows}x${cols},${x_pixels}x${y_pixels}`
        // However, according to https://linux.die.net/man/4/tty_ioctl
        // `x_pixels` and `y_pixels` are unused, so always sending `0` should be fine.
        data: encodeUtf8(`${rows}x${cols},0x0\0`)
      }));
    }
    sigint() {
      return this.#writeStdin(new Uint8Array([3]));
    }
    kill() {
      return this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/spawner.js
  var AdbShellProtocolSpawner = class {
    #spawn;
    constructor(spawn) {
      this.#spawn = spawn;
    }
    spawn(command, signal) {
      signal?.throwIfAborted();
      if (typeof command === "string") {
        command = splitCommand(command);
      }
      return this.#spawn(command, signal);
    }
    async spawnWait(command) {
      const process = await this.spawn(command);
      const [stdout, stderr, exitCode] = await Promise.all([
        process.stdout.pipeThrough(new ConcatBufferStream()),
        process.stderr.pipeThrough(new ConcatBufferStream()),
        process.exited
      ]);
      return { stdout, stderr, exitCode };
    }
    async spawnWaitText(command) {
      const process = await this.spawn(command);
      const [stdout, stderr, exitCode] = await Promise.all([
        process.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream()),
        process.stderr.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream()),
        process.exited
      ]);
      return { stdout, stderr, exitCode };
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/shell/service.js
  var AdbShellProtocolSubprocessService = class extends AdbShellProtocolSpawner {
    #adb;
    get adb() {
      return this.#adb;
    }
    get isSupported() {
      return this.#adb.canUseFeature(AdbFeature.ShellV2);
    }
    constructor(adb) {
      super(async (command, signal) => {
        const socket = await this.#adb.createSocket(`shell,v2,raw:${command.join(" ")}`);
        if (signal?.aborted) {
          await socket.close();
          throw signal.reason;
        }
        return new AdbShellProtocolProcessImpl(socket, signal);
      });
      this.#adb = adb;
    }
    async pty(options) {
      let service = "shell,v2,pty";
      if (options?.terminalType) {
        service += `,TERM=` + options.terminalType;
      }
      service += ":";
      if (options) {
        if (typeof options.command === "string") {
          service += options.command;
        } else if (Array.isArray(options.command)) {
          service += options.command.join(" ");
        }
      }
      return new AdbShellProtocolPtyProcess(await this.#adb.createSocket(service));
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/subprocess/service.js
  var AdbSubprocessService = class {
    #adb;
    get adb() {
      return this.#adb;
    }
    #noneProtocol;
    get noneProtocol() {
      return this.#noneProtocol;
    }
    #shellProtocol;
    get shellProtocol() {
      return this.#shellProtocol;
    }
    constructor(adb) {
      this.#adb = adb;
      this.#noneProtocol = new AdbNoneProtocolSubprocessService(adb);
      if (adb.canUseFeature(AdbFeature.ShellV2)) {
        this.#shellProtocol = new AdbShellProtocolSubprocessService(adb);
      }
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/sync/response.js
  function encodeAsciiUnchecked(value) {
    const result = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      result[i] = value.charCodeAt(i);
    }
    return result;
  }
  // @__NO_SIDE_EFFECTS__
  function adbSyncEncodeId(value) {
    const buffer2 = encodeAsciiUnchecked(value);
    return getUint32LittleEndian(buffer2, 0);
  }
  var AdbSyncResponseId = {
    Entry: /* @__PURE__ */ adbSyncEncodeId("DENT"),
    Entry2: /* @__PURE__ */ adbSyncEncodeId("DNT2"),
    Lstat: /* @__PURE__ */ adbSyncEncodeId("STAT"),
    Stat: /* @__PURE__ */ adbSyncEncodeId("STA2"),
    Lstat2: /* @__PURE__ */ adbSyncEncodeId("LST2"),
    Done: /* @__PURE__ */ adbSyncEncodeId("DONE"),
    Data: /* @__PURE__ */ adbSyncEncodeId("DATA"),
    Ok: /* @__PURE__ */ adbSyncEncodeId("OKAY"),
    Fail: /* @__PURE__ */ adbSyncEncodeId("FAIL")
  };
  var AdbSyncError = class extends Error {
  };
  var AdbSyncFailResponse = struct({ message: string(u32) }, {
    littleEndian: true,
    postDeserialize(value) {
      throw new AdbSyncError(value.message);
    }
  });
  async function adbSyncReadResponse(stream, id, type) {
    if (typeof id === "string") {
      id = /* @__PURE__ */ adbSyncEncodeId(id);
    }
    const buffer2 = await stream.readExactly(4);
    switch (getUint32LittleEndian(buffer2, 0)) {
      case AdbSyncResponseId.Fail:
        await AdbSyncFailResponse.deserialize(stream);
        throw new Error("Unreachable");
      case id:
        return await type.deserialize(stream);
      default:
        throw new Error(`Expected '${id}', but got '${decodeUtf8(buffer2)}'`);
    }
  }
  async function* adbSyncReadResponses(stream, id, type) {
    if (typeof id === "string") {
      id = /* @__PURE__ */ adbSyncEncodeId(id);
    }
    while (true) {
      const buffer2 = await stream.readExactly(4);
      switch (getUint32LittleEndian(buffer2, 0)) {
        case AdbSyncResponseId.Fail:
          await AdbSyncFailResponse.deserialize(stream);
          unreachable();
        case AdbSyncResponseId.Done:
          await stream.readExactly(type.size);
          return;
        case id:
          yield await type.deserialize(stream);
          break;
        default:
          throw new Error(`Expected '${id}' or '${AdbSyncResponseId.Done}', but got '${decodeUtf8(buffer2)}'`);
      }
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/request.js
  var AdbSyncRequestId = {
    List: adbSyncEncodeId("LIST"),
    ListV2: adbSyncEncodeId("LIS2"),
    Send: adbSyncEncodeId("SEND"),
    SendV2: adbSyncEncodeId("SND2"),
    Lstat: adbSyncEncodeId("STAT"),
    Stat: adbSyncEncodeId("STA2"),
    LstatV2: adbSyncEncodeId("LST2"),
    Data: adbSyncEncodeId("DATA"),
    Done: adbSyncEncodeId("DONE"),
    Receive: adbSyncEncodeId("RECV")
  };
  var AdbSyncNumberRequest = struct({ id: u32, arg: u32 }, { littleEndian: true });
  async function adbSyncWriteRequest(writable, id, value) {
    if (typeof id === "string") {
      id = adbSyncEncodeId(id);
    }
    if (typeof value === "number") {
      await writable.write(AdbSyncNumberRequest.serialize({ id, arg: value }));
      return;
    }
    if (typeof value === "string") {
      value = encodeUtf8(value);
    }
    await writable.write(AdbSyncNumberRequest.serialize({ id, arg: value.length }));
    await writable.write(value);
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/stat.js
  var LinuxFileType = {
    Directory: 4,
    File: 8,
    Link: 10
  };
  var AdbSyncLstatResponse = struct({ mode: u32, size: u32, mtime: u32 }, {
    littleEndian: true,
    extra: {
      get type() {
        return this.mode >> 12;
      },
      get permission() {
        return this.mode & 4095;
      }
    },
    postDeserialize(value) {
      if (value.mode === 0 && value.size === 0 && value.mtime === 0) {
        throw new Error("lstat error");
      }
      return value;
    }
  });
  var AdbSyncStatErrorCode = {
    SUCCESS: 0,
    EACCES: 13,
    EEXIST: 17,
    EFAULT: 14,
    EFBIG: 27,
    EINTR: 4,
    EINVAL: 22,
    EIO: 5,
    EISDIR: 21,
    ELOOP: 40,
    EMFILE: 24,
    ENAMETOOLONG: 36,
    ENFILE: 23,
    ENOENT: 2,
    ENOMEM: 12,
    ENOSPC: 28,
    ENOTDIR: 20,
    EOVERFLOW: 75,
    EPERM: 1,
    EROFS: 30,
    ETXTBSY: 26
  };
  var AdbSyncStatErrorName = /* @__PURE__ */ (() => Object.fromEntries(Object.entries(AdbSyncStatErrorCode).map(([key, value]) => [
    value,
    key
  ])))();
  var AdbSyncStatResponse = struct({
    error: u32(),
    dev: u64,
    ino: u64,
    mode: u32,
    nlink: u32,
    uid: u32,
    gid: u32,
    size: u64,
    atime: u64,
    mtime: u64,
    ctime: u64
  }, {
    littleEndian: true,
    extra: {
      get type() {
        return this.mode >> 12;
      },
      get permission() {
        return this.mode & 4095;
      }
    },
    postDeserialize(value) {
      if (value.error) {
        throw new Error(AdbSyncStatErrorName[value.error]);
      }
      return value;
    }
  });
  async function adbSyncLstat(socket, path, v2) {
    const locked = await socket.lock();
    try {
      if (v2) {
        await adbSyncWriteRequest(locked, AdbSyncRequestId.LstatV2, path);
        return await adbSyncReadResponse(locked, AdbSyncResponseId.Lstat2, AdbSyncStatResponse);
      } else {
        await adbSyncWriteRequest(locked, AdbSyncRequestId.Lstat, path);
        const response = await adbSyncReadResponse(locked, AdbSyncResponseId.Lstat, AdbSyncLstatResponse);
        return {
          mode: response.mode,
          // Convert to `BigInt` to make it compatible with `AdbSyncStatResponse`
          size: BigInt(response.size),
          mtime: BigInt(response.mtime),
          get type() {
            return response.type;
          },
          get permission() {
            return response.permission;
          }
        };
      }
    } finally {
      locked.release();
    }
  }
  async function adbSyncStat(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Stat, path);
      return await adbSyncReadResponse(locked, AdbSyncResponseId.Stat, AdbSyncStatResponse);
    } finally {
      locked.release();
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/list.js
  var AdbSyncEntryResponse = extend(AdbSyncLstatResponse, {
    name: string(u32)
  });
  var AdbSyncEntry2Response = extend(AdbSyncStatResponse, {
    name: string(u32)
  });
  async function* adbSyncOpenDirV2(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.ListV2, path);
      for await (const item of adbSyncReadResponses(locked, AdbSyncResponseId.Entry2, AdbSyncEntry2Response)) {
        if (item.error !== AdbSyncStatErrorCode.SUCCESS) {
          continue;
        }
        yield item;
      }
    } finally {
      locked.release();
    }
  }
  async function* adbSyncOpenDirV1(socket, path) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.List, path);
      for await (const item of adbSyncReadResponses(locked, AdbSyncResponseId.Entry, AdbSyncEntryResponse)) {
        yield item;
      }
    } finally {
      locked.release();
    }
  }
  async function* adbSyncOpenDir(socket, path, v2) {
    if (v2) {
      yield* adbSyncOpenDirV2(socket, path);
    } else {
      for await (const item of adbSyncOpenDirV1(socket, path)) {
        yield {
          mode: item.mode,
          size: BigInt(item.size),
          mtime: BigInt(item.mtime),
          get type() {
            return item.type;
          },
          get permission() {
            return item.permission;
          },
          name: item.name
        };
      }
    }
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/pull.js
  var AdbSyncDataResponse = struct({ data: buffer(u32) }, { littleEndian: true });
  async function* adbSyncPullGenerator(socket, path) {
    const locked = await socket.lock();
    let done = false;
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Receive, path);
      for await (const packet of adbSyncReadResponses(locked, AdbSyncResponseId.Data, AdbSyncDataResponse)) {
        yield packet.data;
      }
      done = true;
    } catch (e) {
      done = true;
      throw e;
    } finally {
      if (!done) {
        for await (const packet of adbSyncReadResponses(locked, AdbSyncResponseId.Data, AdbSyncDataResponse)) {
          void packet;
        }
      }
      locked.release();
    }
  }
  function adbSyncPull(socket, path) {
    return ReadableStream2.from(adbSyncPullGenerator(socket, path));
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/push.js
  var ADB_SYNC_MAX_PACKET_SIZE = 64 * 1024;
  var AdbSyncOkResponse = struct({ unused: u32 }, { littleEndian: true });
  async function pipeFileData(locked, file, packetSize, mtime) {
    const abortController = new AbortController2();
    file.pipeThrough(new DistributionStream(packetSize, true)).pipeTo(new maybe_consumable_exports.WritableStream({
      write(chunk) {
        return adbSyncWriteRequest(locked, AdbSyncRequestId.Data, chunk);
      }
    }), { signal: abortController.signal }).then(async () => {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Done, mtime);
      await locked.flush();
    }, NOOP2);
    await adbSyncReadResponse(locked, AdbSyncResponseId.Ok, AdbSyncOkResponse).catch((e) => {
      abortController.abort();
      throw e;
    });
  }
  async function adbSyncPushV1({ socket, filename, file, type = LinuxFileType.File, permission = 438, mtime = Date.now() / 1e3 | 0, packetSize = ADB_SYNC_MAX_PACKET_SIZE }) {
    const locked = await socket.lock();
    try {
      const mode2 = type << 12 | permission;
      const pathAndMode = `${filename},${mode2.toString()}`;
      await adbSyncWriteRequest(locked, AdbSyncRequestId.Send, pathAndMode);
      await pipeFileData(locked, file, packetSize, mtime);
    } finally {
      locked.release();
    }
  }
  var AdbSyncSendV2Flags = {
    None: 0,
    Brotli: 1,
    /**
     * 2
     */
    Lz4: 1 << 1,
    /**
     * 4
     */
    Zstd: 1 << 2,
    DryRun: 2147483648
  };
  var AdbSyncSendV2Request = struct({ id: u32, mode: u32, flags: u32() }, { littleEndian: true });
  async function adbSyncPushV2({ socket, filename, file, type = LinuxFileType.File, permission = 438, mtime = Date.now() / 1e3 | 0, packetSize = ADB_SYNC_MAX_PACKET_SIZE, dryRun = false }) {
    const locked = await socket.lock();
    try {
      await adbSyncWriteRequest(locked, AdbSyncRequestId.SendV2, filename);
      const mode2 = type << 12 | permission;
      let flags = AdbSyncSendV2Flags.None;
      if (dryRun) {
        flags |= AdbSyncSendV2Flags.DryRun;
      }
      await locked.write(AdbSyncSendV2Request.serialize({
        id: AdbSyncRequestId.SendV2,
        mode: mode2,
        flags
      }));
      await pipeFileData(locked, file, packetSize, mtime);
    } finally {
      locked.release();
    }
  }
  function adbSyncPush(options) {
    if (options.v2) {
      return adbSyncPushV2(options);
    }
    if (options.dryRun) {
      throw new Error("dryRun is not supported in v1");
    }
    return adbSyncPushV1(options);
  }

  // node_modules/@yume-chan/adb/esm/commands/sync/socket.js
  var AdbSyncSocketLocked = class {
    #writer;
    #readable;
    #socketLock;
    #writeLock = new AutoResetEvent();
    #combiner;
    get position() {
      return this.#readable.position;
    }
    constructor(writer, readable, bufferSize, lock) {
      this.#writer = writer;
      this.#readable = readable;
      this.#socketLock = lock;
      this.#combiner = new BufferCombiner(bufferSize);
    }
    #write(buffer2) {
      return Consumable.WritableStream.write(this.#writer, buffer2);
    }
    async flush() {
      try {
        await this.#writeLock.wait();
        const buffer2 = this.#combiner.flush();
        if (buffer2) {
          await this.#write(buffer2);
        }
      } finally {
        this.#writeLock.notifyOne();
      }
    }
    async write(data) {
      try {
        await this.#writeLock.wait();
        for (const buffer2 of this.#combiner.push(data)) {
          await this.#write(buffer2);
        }
      } finally {
        this.#writeLock.notifyOne();
      }
    }
    async readExactly(length) {
      await this.flush();
      return await this.#readable.readExactly(length);
    }
    release() {
      this.#combiner.flush();
      this.#socketLock.notifyOne();
    }
    async close() {
      await this.#readable.cancel();
    }
  };
  var AdbSyncSocket = class {
    #lock = new AutoResetEvent();
    #socket;
    #locked;
    constructor(socket, bufferSize) {
      this.#socket = socket;
      this.#locked = new AdbSyncSocketLocked(socket.writable.getWriter(), new BufferedReadableStream(socket.readable), bufferSize, this.#lock);
    }
    async lock() {
      await this.#lock.wait();
      return this.#locked;
    }
    async close() {
      await this.#locked.close();
      await this.#socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/sync/sync.js
  function dirname(path) {
    const end = path.lastIndexOf("/");
    if (end === -1) {
      throw new Error(`Invalid path`);
    }
    if (end === 0) {
      return "/";
    }
    return path.substring(0, end);
  }
  var AdbSync = class {
    _adb;
    _socket;
    #supportsStat;
    #supportsListV2;
    #fixedPushMkdir;
    #supportsSendReceiveV2;
    #needPushMkdirWorkaround;
    get supportsStat() {
      return this.#supportsStat;
    }
    get supportsListV2() {
      return this.#supportsListV2;
    }
    get fixedPushMkdir() {
      return this.#fixedPushMkdir;
    }
    get supportsSendReceiveV2() {
      return this.#supportsSendReceiveV2;
    }
    get needPushMkdirWorkaround() {
      return this.#needPushMkdirWorkaround;
    }
    constructor(adb, socket) {
      this._adb = adb;
      this._socket = new AdbSyncSocket(socket, adb.maxPayloadSize);
      this.#supportsStat = adb.canUseFeature(AdbFeature.StatV2);
      this.#supportsListV2 = adb.canUseFeature(AdbFeature.ListV2);
      this.#fixedPushMkdir = adb.canUseFeature(AdbFeature.FixedPushMkdir);
      this.#supportsSendReceiveV2 = adb.canUseFeature(AdbFeature.SendReceiveV2);
      this.#needPushMkdirWorkaround = this._adb.canUseFeature(AdbFeature.ShellV2) && !this.fixedPushMkdir;
    }
    /**
     * Gets information of a file or folder.
     *
     * If `path` points to a symbolic link, the returned information is about the link itself (with `type` being `LinuxFileType.Link`).
     */
    async lstat(path) {
      return await adbSyncLstat(this._socket, path, this.#supportsStat);
    }
    /**
     * Gets the information of a file or folder.
     *
     * If `path` points to a symbolic link, it will be resolved and the returned information is about the target (with `type` being `LinuxFileType.File` or `LinuxFileType.Directory`).
     */
    async stat(path) {
      if (!this.#supportsStat) {
        throw new Error("Not supported");
      }
      return await adbSyncStat(this._socket, path);
    }
    /**
     * Checks if `path` is a directory, or a symbolic link to a directory.
     *
     * This uses `lstat` internally, thus works on all Android versions.
     */
    async isDirectory(path) {
      try {
        await this.lstat(path + "/");
        return true;
      } catch {
        return false;
      }
    }
    opendir(path) {
      return adbSyncOpenDir(this._socket, path, this.supportsListV2);
    }
    async readdir(path) {
      const results = [];
      for await (const entry of this.opendir(path)) {
        results.push(entry);
      }
      return results;
    }
    /**
     * Reads the content of a file on device.
     *
     * @param filename The full path of the file on device to read.
     * @returns A `ReadableStream` that contains the file content.
     */
    read(filename) {
      return adbSyncPull(this._socket, filename);
    }
    /**
     * Writes a file on device. If the file name already exists, it will be overwritten.
     *
     * @param options The content and options of the file to write.
     */
    async write(options) {
      if (this.needPushMkdirWorkaround) {
        await this._adb.subprocess.noneProtocol.spawnWait([
          "mkdir",
          "-p",
          escapeArg(dirname(options.filename))
        ]);
      }
      await adbSyncPush({
        v2: this.supportsSendReceiveV2,
        socket: this._socket,
        ...options
      });
    }
    lockSocket() {
      return this._socket.lock();
    }
    dispose() {
      return this._socket.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/commands/tcpip.js
  function parsePort(value) {
    if (!value || value === "0") {
      return void 0;
    }
    return Number.parseInt(value, 10);
  }
  var AdbTcpIpService = class extends AdbServiceBase {
    async getListenAddresses() {
      const serviceListenAddresses = await this.adb.getProp("service.adb.listen_addrs");
      const servicePort = await this.adb.getProp("service.adb.tcp.port");
      const persistPort = await this.adb.getProp("persist.adb.tcp.port");
      return {
        serviceListenAddresses: serviceListenAddresses != "" ? serviceListenAddresses.split(",") : [],
        servicePort: parsePort(servicePort),
        persistPort: parsePort(persistPort)
      };
    }
    async setPort(port) {
      if (port <= 0) {
        throw new TypeError(`Invalid port ${port}`);
      }
      const output = await this.adb.createSocketAndWait(`tcpip:${port}`);
      if (output !== `restarting in TCP mode port: ${port}
`) {
        throw new Error(output);
      }
      return output;
    }
    async disable() {
      const output = await this.adb.createSocketAndWait("usb:");
      if (output !== "restarting in USB mode\n") {
        throw new Error(output);
      }
      return output;
    }
  };

  // node_modules/@yume-chan/adb/esm/adb.js
  var Adb = class {
    #transport;
    get transport() {
      return this.#transport;
    }
    get serial() {
      return this.#transport.serial;
    }
    get maxPayloadSize() {
      return this.#transport.maxPayloadSize;
    }
    get banner() {
      return this.#transport.banner;
    }
    get disconnected() {
      return this.#transport.disconnected;
    }
    get clientFeatures() {
      return this.#transport.clientFeatures;
    }
    get deviceFeatures() {
      return this.banner.features;
    }
    subprocess;
    power;
    reverse;
    tcpip;
    constructor(transport) {
      this.#transport = transport;
      this.subprocess = new AdbSubprocessService(this);
      this.power = new AdbPower(this);
      this.reverse = new AdbReverseService(this);
      this.tcpip = new AdbTcpIpService(this);
    }
    canUseFeature(feature) {
      return this.clientFeatures.includes(feature) && this.deviceFeatures.includes(feature);
    }
    /**
     * Creates a new ADB Socket to the specified service or socket address.
     */
    async createSocket(service) {
      return this.#transport.connect(service);
    }
    async createSocketAndWait(service) {
      const socket = await this.createSocket(service);
      return await socket.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream());
    }
    getProp(key) {
      return this.subprocess.noneProtocol.spawnWaitText(["getprop", key]).then((output) => output.trim());
    }
    rm(filenames, options) {
      const args = ["rm"];
      if (options?.recursive) {
        args.push("-r");
      }
      if (options?.force) {
        args.push("-f");
      }
      if (Array.isArray(filenames)) {
        for (const filename of filenames) {
          args.push(escapeArg(filename));
        }
      } else {
        args.push(escapeArg(filenames));
      }
      args.push("</dev/null");
      return this.subprocess.noneProtocol.spawnWaitText(args);
    }
    async sync() {
      const socket = await this.createSocket("sync:");
      return new AdbSync(this, socket);
    }
    async framebuffer() {
      return framebuffer(this);
    }
    async close() {
      await this.#transport.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/banner.js
  var AdbBannerKey = {
    Product: "ro.product.name",
    Model: "ro.product.model",
    Device: "ro.product.device",
    Features: "features"
  };
  var AdbBanner = class _AdbBanner {
    static parse(banner) {
      let state;
      let product;
      let model;
      let device;
      let features = [];
      const pieces = banner.split("::");
      if (pieces.length > 1) {
        state = pieces[0].trim() || void 0;
        const props = pieces[1];
        for (const prop of props.split(";")) {
          if (!prop) {
            continue;
          }
          const keyValue = prop.split("=");
          if (keyValue.length !== 2) {
            continue;
          }
          const [key, value] = keyValue;
          switch (key) {
            case AdbBannerKey.Product:
              product = value;
              break;
            case AdbBannerKey.Model:
              model = value;
              break;
            case AdbBannerKey.Device:
              device = value;
              break;
            case AdbBannerKey.Features:
              features = value.split(",");
              break;
          }
        }
      }
      return new _AdbBanner(state, product, model, device, features);
    }
    #state;
    get state() {
      return this.#state;
    }
    #product;
    get product() {
      return this.#product;
    }
    #model;
    get model() {
      return this.#model;
    }
    #device;
    get device() {
      return this.#device;
    }
    #features = [];
    get features() {
      return this.#features;
    }
    // eslint-disable-next-line @typescript-eslint/max-params
    constructor(state, product, model, device, features) {
      this.#state = state;
      this.#product = product;
      this.#model = model;
      this.#device = device;
      this.#features = features;
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/crypto.js
  function getBigUint(array, byteOffset, length) {
    let result = 0n;
    for (let j = 0; j < length % 8; j += 1) {
      result = result << 8n | BigInt(array[byteOffset + j]);
    }
    for (let i = byteOffset + length % 8; i < byteOffset + length; i += 8) {
      result <<= 64n;
      const value = getUint64BigEndian(array, i);
      result |= value;
    }
    return result;
  }
  function setBigUint(array, byteOffset, length, value, littleEndian) {
    if (littleEndian) {
      while (value > 0n) {
        setInt64LittleEndian(array, byteOffset, value);
        byteOffset += 8;
        value >>= 64n;
      }
    } else {
      let position = byteOffset + length - 8;
      while (value > 0n) {
        setInt64BigEndian(array, position, value);
        position -= 8;
        value >>= 64n;
      }
    }
  }
  function derHeader(data, offset) {
    offset = offset + 1;
    let length = data[offset];
    offset += 1;
    if (length & 128) {
      const lengthBytes = length & 127;
      length = 0;
      for (let i = 0; i < lengthBytes; i += 1) {
        length = length << 8 | data[offset];
        offset += 1;
      }
    }
    return { offset, length };
  }
  function rsaParsePrivateKey(key) {
    let offset = derHeader(key, 0).offset;
    let header = derHeader(key, offset);
    offset = header.offset + header.length;
    header = derHeader(key, offset);
    offset = header.offset + header.length;
    offset = derHeader(key, offset).offset;
    offset = derHeader(key, offset).offset;
    header = derHeader(key, offset);
    offset = header.offset + header.length;
    const nHeader = derHeader(key, offset);
    offset = nHeader.offset + nHeader.length;
    const eHeader = derHeader(key, offset);
    offset = eHeader.offset + eHeader.length;
    const dHeader = derHeader(key, offset);
    const n = getBigUint(key, nHeader.offset, nHeader.length);
    const d = getBigUint(key, dHeader.offset, dHeader.length);
    return [n, d];
  }
  function nonNegativeMod(m, d) {
    const r = m % d;
    if (r > 0) {
      return r;
    }
    return r + (d > 0 ? d : -d);
  }
  function modInverse(a, m) {
    a = nonNegativeMod(a, m);
    if (!a || m < 2) {
      return NaN;
    }
    const s = [];
    let b = m;
    while (b) {
      [a, b] = [b, a % b];
      s.push({ a, b });
    }
    if (a !== 1) {
      return NaN;
    }
    let x = 1;
    let y = 0;
    for (let i = s.length - 2; i >= 0; i -= 1) {
      [x, y] = [y, x - y * Math.floor(s[i].a / s[i].b)];
    }
    return nonNegativeMod(y, m);
  }
  var ModulusLengthInBytes = 2048 / 8;
  var ModulusLengthInWords = ModulusLengthInBytes / 4;
  function adbGetPublicKeySize() {
    return 4 + 4 + ModulusLengthInBytes + ModulusLengthInBytes + 4;
  }
  function adbGeneratePublicKey(privateKey, output) {
    let outputType;
    const outputLength = adbGetPublicKeySize();
    if (!output) {
      output = new Uint8Array(outputLength);
      outputType = "Uint8Array";
    } else {
      if (output.length < outputLength) {
        throw new TypeError("output buffer is too small");
      }
      outputType = "number";
    }
    const outputView = new DataView(output.buffer, output.byteOffset, output.length);
    let outputOffset = 0;
    outputView.setUint32(outputOffset, ModulusLengthInWords, true);
    outputOffset += 4;
    const [n] = rsaParsePrivateKey(privateKey);
    const n0inv = -modInverse(Number(n % 2n ** 32n), 2 ** 32);
    outputView.setInt32(outputOffset, n0inv, true);
    outputOffset += 4;
    setBigUint(output, outputOffset, ModulusLengthInBytes, n, true);
    outputOffset += ModulusLengthInBytes;
    const rr = 2n ** 4096n % n;
    setBigUint(output, outputOffset, ModulusLengthInBytes, rr, true);
    outputOffset += ModulusLengthInBytes;
    outputView.setUint32(outputOffset, 65537, true);
    if (outputType === "Uint8Array") {
      return output;
    } else {
      return outputLength;
    }
  }
  function powMod(base, exponent, modulus) {
    if (modulus === 1n) {
      return 0n;
    }
    let r = 1n;
    base = base % modulus;
    while (exponent > 0n) {
      if (BigInt.asUintN(1, exponent) === 1n) {
        r = r * base % modulus;
      }
      base = base * base % modulus;
      exponent >>= 1n;
    }
    return r;
  }
  var SHA1_DIGEST_LENGTH = 20;
  var ASN1_SEQUENCE = 48;
  var ASN1_OCTET_STRING = 4;
  var ASN1_NULL = 5;
  var ASN1_OID = 6;
  var SHA1_DIGEST_INFO = new Uint8Array([
    ASN1_SEQUENCE,
    13 + SHA1_DIGEST_LENGTH,
    ASN1_SEQUENCE,
    9,
    // SHA-1 (1 3 14 3 2 26)
    ASN1_OID,
    5,
    1 * 40 + 3,
    14,
    3,
    2,
    26,
    ASN1_NULL,
    0,
    ASN1_OCTET_STRING,
    SHA1_DIGEST_LENGTH
  ]);
  function rsaSign(privateKey, data) {
    const [n, d] = rsaParsePrivateKey(privateKey);
    const padded = new Uint8Array(256);
    let index = 0;
    padded[index] = 0;
    index += 1;
    padded[index] = 1;
    index += 1;
    const fillLength = padded.length - SHA1_DIGEST_INFO.length - data.length - 1;
    while (index < fillLength) {
      padded[index] = 255;
      index += 1;
    }
    padded[index] = 0;
    index += 1;
    padded.set(SHA1_DIGEST_INFO, index);
    index += SHA1_DIGEST_INFO.length;
    padded.set(data, index);
    const signature = powMod(getBigUint(padded, 0, padded.length), d, n);
    setBigUint(padded, 0, padded.length, signature, false);
    return padded;
  }

  // node_modules/@yume-chan/adb/esm/daemon/packet.js
  var AdbCommand = {
    Auth: 1213486401,
    // 'AUTH'
    Close: 1163086915,
    // 'CLSE'
    Connect: 1314410051,
    // 'CNXN'
    Okay: 1497451343,
    // 'OKAY'
    Open: 1313165391,
    // 'OPEN'
    Write: 1163154007
    // 'WRTE'
  };
  var AdbPacketHeader = struct({
    command: u32,
    arg0: u32,
    arg1: u32,
    payloadLength: u32,
    checksum: u32,
    magic: s32
  }, { littleEndian: true });
  var AdbPacket = extend(AdbPacketHeader, {
    payload: buffer("payloadLength")
  });
  function calculateChecksum(payload) {
    return payload.reduce((result, item) => result + item, 0);
  }
  var AdbPacketSerializeStream = class extends TransformStream2 {
    constructor() {
      const headerBuffer = new Uint8Array(AdbPacketHeader.size);
      super({
        transform: async (chunk, controller) => {
          await chunk.tryConsume(async (chunk2) => {
            const init = chunk2;
            init.payloadLength = init.payload.length;
            AdbPacketHeader.serialize(init, headerBuffer);
            await Consumable.ReadableStream.enqueue(controller, headerBuffer);
            if (init.payloadLength) {
              await Consumable.ReadableStream.enqueue(controller, init.payload);
            }
          });
        }
      });
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/auth.js
  var AdbAuthType = {
    Token: 1,
    Signature: 2,
    PublicKey: 3
  };
  var AdbSignatureAuthenticator = async function* (credentialStore, getNextRequest) {
    for await (const key of credentialStore.iterateKeys()) {
      const packet = await getNextRequest();
      if (packet.arg0 !== AdbAuthType.Token) {
        return;
      }
      const signature = rsaSign(key.buffer, packet.payload);
      yield {
        command: AdbCommand.Auth,
        arg0: AdbAuthType.Signature,
        arg1: 0,
        payload: signature
      };
    }
  };
  var AdbPublicKeyAuthenticator = async function* (credentialStore, getNextRequest) {
    const packet = await getNextRequest();
    if (packet.arg0 !== AdbAuthType.Token) {
      return;
    }
    let privateKey;
    for await (const key of credentialStore.iterateKeys()) {
      privateKey = key;
      break;
    }
    if (!privateKey) {
      privateKey = await credentialStore.generateKey();
    }
    const publicKeyLength = adbGetPublicKeySize();
    const [publicKeyBase64Length] = calculateBase64EncodedLength(publicKeyLength);
    const nameBuffer = privateKey.name?.length ? encodeUtf8(privateKey.name) : EmptyUint8Array;
    const publicKeyBuffer = new Uint8Array(publicKeyBase64Length + (nameBuffer.length ? nameBuffer.length + 1 : 0) + // Space character + name
    1);
    adbGeneratePublicKey(privateKey.buffer, publicKeyBuffer);
    encodeBase64(publicKeyBuffer.subarray(0, publicKeyLength), publicKeyBuffer);
    if (nameBuffer.length) {
      publicKeyBuffer[publicKeyBase64Length] = 32;
      publicKeyBuffer.set(nameBuffer, publicKeyBase64Length + 1);
    }
    yield {
      command: AdbCommand.Auth,
      arg0: AdbAuthType.PublicKey,
      arg1: 0,
      payload: publicKeyBuffer
    };
  };
  var ADB_DEFAULT_AUTHENTICATORS = [
    AdbSignatureAuthenticator,
    AdbPublicKeyAuthenticator
  ];
  var AdbAuthenticationProcessor = class {
    authenticators;
    #credentialStore;
    #pendingRequest = new PromiseResolver();
    #iterator;
    constructor(authenticators, credentialStore) {
      this.authenticators = authenticators;
      this.#credentialStore = credentialStore;
    }
    #getNextRequest = () => {
      return this.#pendingRequest.promise;
    };
    async *#invokeAuthenticator() {
      for (const authenticator of this.authenticators) {
        for await (const packet of authenticator(this.#credentialStore, this.#getNextRequest)) {
          this.#pendingRequest = new PromiseResolver();
          yield packet;
        }
      }
    }
    async process(packet) {
      if (!this.#iterator) {
        this.#iterator = this.#invokeAuthenticator();
      }
      this.#pendingRequest.resolve(packet);
      const result = await this.#iterator.next();
      if (result.done) {
        throw new Error("No authenticator can handle the request");
      }
      return result.value;
    }
    dispose() {
      void this.#iterator?.return?.();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/socket.js
  var AdbDaemonSocketController = class {
    #dispatcher;
    localId;
    remoteId;
    localCreated;
    service;
    #readable;
    #readableController;
    get readable() {
      return this.#readable;
    }
    #writableController;
    writable;
    #closed = false;
    #closedPromise = new PromiseResolver();
    get closed() {
      return this.#closedPromise.promise;
    }
    #socket;
    get socket() {
      return this.#socket;
    }
    #availableWriteBytesChanged;
    /**
     * When delayed ack is disabled, returns `Infinity` if the socket is ready to write
     * (exactly one packet can be written no matter how large it is), or `-1` if the socket
     * is waiting for ack message.
     *
     * When delayed ack is enabled, returns a non-negative finite number indicates the number of
     * bytes that can be written to the socket before waiting for ack message.
     */
    #availableWriteBytes = 0;
    constructor(options) {
      this.#dispatcher = options.dispatcher;
      this.localId = options.localId;
      this.remoteId = options.remoteId;
      this.localCreated = options.localCreated;
      this.service = options.service;
      this.#readable = new PushReadableStream((controller) => {
        this.#readableController = controller;
      });
      this.writable = new maybe_consumable_exports.WritableStream({
        start: (controller) => {
          this.#writableController = controller;
          controller.signal.addEventListener("abort", () => {
            this.#availableWriteBytesChanged?.reject(controller.signal.reason);
          });
        },
        write: async (data) => {
          const size = data.length;
          const chunkSize = this.#dispatcher.options.maxPayloadSize;
          for (let start = 0, end = chunkSize; start < size; start = end, end += chunkSize) {
            const chunk = data.subarray(start, end);
            await this.#writeChunk(chunk);
          }
        }
      });
      this.#socket = new AdbDaemonSocket(this);
      this.#availableWriteBytes = options.availableWriteBytes;
    }
    async #writeChunk(data) {
      const length = data.length;
      while (this.#availableWriteBytes < length) {
        const resolver = new PromiseResolver();
        this.#availableWriteBytesChanged = resolver;
        await resolver.promise;
      }
      if (this.#availableWriteBytes === Infinity) {
        this.#availableWriteBytes = -1;
      } else {
        this.#availableWriteBytes -= length;
      }
      await this.#dispatcher.sendPacket(AdbCommand.Write, this.localId, this.remoteId, data);
    }
    async enqueue(data) {
      await this.#readableController.enqueue(data);
    }
    ack(bytes) {
      this.#availableWriteBytes += bytes;
      this.#availableWriteBytesChanged?.resolve();
    }
    async close() {
      if (this.#closed) {
        return;
      }
      this.#closed = true;
      this.#availableWriteBytesChanged?.reject(new Error("Socket closed"));
      try {
        this.#writableController.error(new Error("Socket closed"));
      } catch {
      }
      await this.#dispatcher.sendPacket(AdbCommand.Close, this.localId, this.remoteId, EmptyUint8Array);
    }
    dispose() {
      this.#readableController.close();
      this.#closedPromise.resolve(void 0);
    }
  };
  var AdbDaemonSocket = class {
    #controller;
    get localId() {
      return this.#controller.localId;
    }
    get remoteId() {
      return this.#controller.remoteId;
    }
    get localCreated() {
      return this.#controller.localCreated;
    }
    get service() {
      return this.#controller.service;
    }
    get readable() {
      return this.#controller.readable;
    }
    get writable() {
      return this.#controller.writable;
    }
    get closed() {
      return this.#controller.closed;
    }
    constructor(controller) {
      this.#controller = controller;
    }
    close() {
      return this.#controller.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/dispatcher.js
  var AdbPacketDispatcher = class {
    // ADB socket id starts from 1
    // (0 means open failed)
    #initializers = new AsyncOperationManager(1);
    /**
     * Socket local ID to the socket controller.
     */
    #sockets = /* @__PURE__ */ new Map();
    #writer;
    options;
    #closed = false;
    #disconnected = new PromiseResolver();
    get disconnected() {
      return this.#disconnected.promise;
    }
    #incomingSocketHandlers = /* @__PURE__ */ new Map();
    #readAbortController = new AbortController2();
    constructor(connection, options) {
      this.options = options;
      if (this.options.initialDelayedAckBytes < 0) {
        this.options.initialDelayedAckBytes = 0;
      }
      connection.readable.pipeTo(new WritableStream({
        write: async (packet, controller) => {
          switch (packet.command) {
            case AdbCommand.Close:
              await this.#handleClose(packet);
              break;
            case AdbCommand.Okay:
              this.#handleOkay(packet);
              break;
            case AdbCommand.Open:
              await this.#handleOpen(packet);
              break;
            case AdbCommand.Write:
              this.#handleWrite(packet).catch((e) => {
                controller.error(e);
              });
              break;
            default:
              throw new Error(`Unknown command: ${packet.command.toString(16)}`);
          }
        }
      }), {
        preventCancel: options.preserveConnection ?? false,
        signal: this.#readAbortController.signal
      }).then(() => {
        this.#dispose();
      }, (e) => {
        if (!this.#closed) {
          this.#disconnected.reject(e);
        }
        this.#dispose();
      });
      this.#writer = connection.writable.getWriter();
    }
    async #handleClose(packet) {
      if (packet.arg0 === 0 && this.#initializers.reject(packet.arg1, new Error("Socket open failed"))) {
        return;
      }
      const socket = this.#sockets.get(packet.arg1);
      if (socket) {
        await socket.close();
        socket.dispose();
        this.#sockets.delete(packet.arg1);
        return;
      }
    }
    #handleOkay(packet) {
      let ackBytes;
      if (this.options.initialDelayedAckBytes !== 0) {
        if (packet.payload.length !== 4) {
          throw new Error("Invalid OKAY packet. Payload size should be 4");
        }
        ackBytes = getUint32LittleEndian(packet.payload, 0);
      } else {
        if (packet.payload.length !== 0) {
          throw new Error("Invalid OKAY packet. Payload size should be 0");
        }
        ackBytes = Infinity;
      }
      if (this.#initializers.resolve(packet.arg1, {
        remoteId: packet.arg0,
        availableWriteBytes: ackBytes
      })) {
        return;
      }
      const socket = this.#sockets.get(packet.arg1);
      if (socket) {
        socket.ack(ackBytes);
        return;
      }
      void this.sendPacket(AdbCommand.Close, packet.arg1, packet.arg0, EmptyUint8Array);
    }
    #sendOkay(localId, remoteId, ackBytes) {
      let payload;
      if (this.options.initialDelayedAckBytes !== 0) {
        payload = new Uint8Array(4);
        setUint32LittleEndian(payload, 0, ackBytes);
      } else {
        payload = EmptyUint8Array;
      }
      return this.sendPacket(AdbCommand.Okay, localId, remoteId, payload);
    }
    async #handleOpen(packet) {
      const [localId] = this.#initializers.add();
      this.#initializers.resolve(localId, void 0);
      const remoteId = packet.arg0;
      let availableWriteBytes = packet.arg1;
      let service = decodeUtf8(packet.payload);
      if (service.endsWith("\0")) {
        service = service.substring(0, service.length - 1);
      }
      if (this.options.initialDelayedAckBytes === 0) {
        if (availableWriteBytes !== 0) {
          throw new Error("Invalid OPEN packet. arg1 should be 0");
        }
        availableWriteBytes = Infinity;
      } else {
        if (availableWriteBytes === 0) {
          throw new Error("Invalid OPEN packet. arg1 should be greater than 0");
        }
      }
      const handler = this.#incomingSocketHandlers.get(service);
      if (!handler) {
        await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
        return;
      }
      const controller = new AdbDaemonSocketController({
        dispatcher: this,
        localId,
        remoteId,
        localCreated: false,
        service,
        availableWriteBytes
      });
      try {
        await handler(controller.socket);
        this.#sockets.set(localId, controller);
        await this.#sendOkay(localId, remoteId, this.options.initialDelayedAckBytes);
      } catch {
        await this.sendPacket(AdbCommand.Close, 0, remoteId, EmptyUint8Array);
      }
    }
    async #handleWrite(packet) {
      const socket = this.#sockets.get(packet.arg1);
      if (!socket) {
        throw new Error(`Unknown local socket id: ${packet.arg1}`);
      }
      let handled = false;
      const promises = [
        (async () => {
          await socket.enqueue(packet.payload);
          await this.#sendOkay(packet.arg1, packet.arg0, packet.payload.length);
          handled = true;
        })()
      ];
      if (this.options.readTimeLimit) {
        promises.push((async () => {
          await delay(this.options.readTimeLimit);
          if (!handled) {
            throw new Error(`readable of \`${socket.service}\` has stalled for ${this.options.readTimeLimit} milliseconds`);
          }
        })());
      }
      await Promise.race(promises);
    }
    async createSocket(service) {
      if (this.options.appendNullToServiceString) {
        service += "\0";
      }
      const [localId, initializer] = this.#initializers.add();
      await this.sendPacket(AdbCommand.Open, localId, this.options.initialDelayedAckBytes, service);
      const { remoteId, availableWriteBytes } = await initializer;
      const controller = new AdbDaemonSocketController({
        dispatcher: this,
        localId,
        remoteId,
        localCreated: true,
        service,
        availableWriteBytes
      });
      this.#sockets.set(localId, controller);
      return controller.socket;
    }
    addReverseTunnel(service, handler) {
      this.#incomingSocketHandlers.set(service, handler);
    }
    removeReverseTunnel(address) {
      this.#incomingSocketHandlers.delete(address);
    }
    clearReverseTunnels() {
      this.#incomingSocketHandlers.clear();
    }
    async sendPacket(command, arg0, arg1, payload) {
      if (typeof payload === "string") {
        payload = encodeUtf8(payload);
      }
      if (payload.length > this.options.maxPayloadSize) {
        throw new TypeError("payload too large");
      }
      await Consumable.WritableStream.write(this.#writer, {
        command,
        arg0,
        arg1,
        payload,
        checksum: this.options.calculateChecksum ? calculateChecksum(payload) : 0,
        magic: command ^ 4294967295
      });
    }
    async close() {
      await Promise.all(Array.from(this.#sockets.values(), (socket) => socket.close()));
      this.#closed = true;
      this.#readAbortController.abort();
      if (this.options.preserveConnection) {
        this.#writer.releaseLock();
      } else {
        await this.#writer.close();
      }
    }
    #dispose() {
      for (const socket of this.#sockets.values()) {
        socket.dispose();
      }
      this.#disconnected.resolve();
    }
  };

  // node_modules/@yume-chan/adb/esm/daemon/transport.js
  var ADB_DAEMON_VERSION_OMIT_CHECKSUM = 16777217;
  var ADB_DAEMON_DEFAULT_FEATURES = /* @__PURE__ */ (() => [
    AdbFeature.ShellV2,
    AdbFeature.Cmd,
    AdbFeature.StatV2,
    AdbFeature.ListV2,
    AdbFeature.FixedPushMkdir,
    "apex",
    AdbFeature.Abb,
    // only tells the client the symlink timestamp issue in `adb push --sync` has been fixed.
    // No special handling required.
    "fixed_push_symlink_timestamp",
    AdbFeature.AbbExec,
    "remount_shell",
    "track_app",
    AdbFeature.SendReceiveV2,
    "sendrecv_v2_brotli",
    "sendrecv_v2_lz4",
    "sendrecv_v2_zstd",
    "sendrecv_v2_dry_run_send",
    AdbFeature.DelayedAck
  ])();
  var ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE = 32 * 1024 * 1024;
  var AdbDaemonTransport = class _AdbDaemonTransport {
    /**
     * Authenticate with the ADB Daemon and create a new transport.
     */
    static async authenticate({ serial, connection, credentialStore, authenticators = ADB_DEFAULT_AUTHENTICATORS, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes = ADB_DAEMON_DEFAULT_INITIAL_PAYLOAD_SIZE, ...options }) {
      let version = 16777217;
      let maxPayloadSize = 1024 * 1024;
      const resolver = new PromiseResolver();
      const authProcessor = new AdbAuthenticationProcessor(authenticators, credentialStore);
      const abortController = new AbortController2();
      const pipe = connection.readable.pipeTo(new WritableStream({
        async write(packet) {
          switch (packet.command) {
            case AdbCommand.Connect:
              version = Math.min(version, packet.arg0);
              maxPayloadSize = Math.min(maxPayloadSize, packet.arg1);
              resolver.resolve(decodeUtf8(packet.payload));
              break;
            case AdbCommand.Auth: {
              const response = await authProcessor.process(packet);
              await sendPacket(response);
              break;
            }
            default:
              break;
          }
        }
      }), {
        // Don't cancel the source ReadableStream on AbortSignal abort.
        preventCancel: true,
        signal: abortController.signal
      }).then(() => {
        resolver.reject(new Error("Connection closed unexpectedly"));
      }, (e) => {
        resolver.reject(e);
      });
      const writer = connection.writable.getWriter();
      async function sendPacket(init) {
        init.checksum = calculateChecksum(init.payload);
        init.magic = init.command ^ 4294967295;
        await Consumable.WritableStream.write(writer, init);
      }
      const actualFeatures = features.slice();
      if (initialDelayedAckBytes <= 0) {
        const index = features.indexOf(AdbFeature.DelayedAck);
        if (index !== -1) {
          actualFeatures.splice(index, 1);
        }
      }
      let banner;
      try {
        await sendPacket({
          command: AdbCommand.Connect,
          arg0: version,
          arg1: maxPayloadSize,
          // The terminating `;` is required in formal definition
          // But ADB daemon (all versions) can still work without it
          payload: encodeUtf8(`host::features=${actualFeatures.join(",")}`)
        });
        banner = await resolver.promise;
      } finally {
        abortController.abort();
        writer.releaseLock();
        await pipe;
      }
      return new _AdbDaemonTransport({
        serial,
        connection,
        version,
        maxPayloadSize,
        banner,
        features: actualFeatures,
        initialDelayedAckBytes,
        ...options
      });
    }
    #connection;
    get connection() {
      return this.#connection;
    }
    #dispatcher;
    #serial;
    get serial() {
      return this.#serial;
    }
    #protocolVersion;
    get protocolVersion() {
      return this.#protocolVersion;
    }
    get maxPayloadSize() {
      return this.#dispatcher.options.maxPayloadSize;
    }
    #banner;
    get banner() {
      return this.#banner;
    }
    get disconnected() {
      return this.#dispatcher.disconnected;
    }
    #clientFeatures;
    get clientFeatures() {
      return this.#clientFeatures;
    }
    constructor({ serial, connection, version, banner, features = ADB_DAEMON_DEFAULT_FEATURES, initialDelayedAckBytes, ...options }) {
      this.#serial = serial;
      this.#connection = connection;
      this.#banner = AdbBanner.parse(banner);
      this.#clientFeatures = features;
      if (features.includes(AdbFeature.DelayedAck)) {
        if (initialDelayedAckBytes <= 0) {
          throw new TypeError("`initialDelayedAckBytes` must be greater than 0 when DelayedAck feature is enabled.");
        }
        if (!this.#banner.features.includes(AdbFeature.DelayedAck)) {
          initialDelayedAckBytes = 0;
        }
      } else {
        initialDelayedAckBytes = 0;
      }
      let calculateChecksum2;
      let appendNullToServiceString;
      if (version >= ADB_DAEMON_VERSION_OMIT_CHECKSUM) {
        calculateChecksum2 = false;
        appendNullToServiceString = false;
      } else {
        calculateChecksum2 = true;
        appendNullToServiceString = true;
      }
      this.#dispatcher = new AdbPacketDispatcher(connection, {
        calculateChecksum: calculateChecksum2,
        appendNullToServiceString,
        initialDelayedAckBytes,
        ...options
      });
      this.#protocolVersion = version;
    }
    connect(service) {
      return this.#dispatcher.createSocket(service);
    }
    addReverseTunnel(handler, address) {
      if (!address) {
        const id = Math.random().toString().substring(2);
        address = `localabstract:reverse_${id}`;
      }
      this.#dispatcher.addReverseTunnel(address, handler);
      return address;
    }
    removeReverseTunnel(address) {
      this.#dispatcher.removeReverseTunnel(address);
    }
    clearReverseTunnels() {
      this.#dispatcher.clearReverseTunnels();
    }
    close() {
      return this.#dispatcher.close();
    }
  };

  // node_modules/@yume-chan/adb/esm/server/observer.js
  function unorderedRemove(array, index) {
    if (index < 0 || index >= array.length) {
      return;
    }
    array[index] = array[array.length - 1];
    array.length -= 1;
  }

  // node_modules/@yume-chan/adb-daemon-webusb/esm/error.js
  var DeviceBusyError = class extends Error {
    constructor(cause) {
      super("The device is already in used by another program", {
        cause
      });
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/utils.js
  function isErrorName(e, name) {
    return typeof e === "object" && e !== null && "name" in e && e.name === name;
  }
  function isUsbInterfaceFilter(filter) {
    return filter.classCode !== void 0 && filter.subclassCode !== void 0 && filter.protocolCode !== void 0;
  }
  function matchUsbInterfaceFilter(alternate, filter) {
    return alternate.interfaceClass === filter.classCode && alternate.interfaceSubclass === filter.subclassCode && alternate.interfaceProtocol === filter.protocolCode;
  }
  function findUsbInterface(device, filter) {
    for (const configuration of device.configurations) {
      for (const interface_ of configuration.interfaces) {
        for (const alternate of interface_.alternates) {
          if (matchUsbInterfaceFilter(alternate, filter)) {
            return { configuration, interface_, alternate };
          }
        }
      }
    }
    return void 0;
  }
  function padNumber(value) {
    return value.toString(16).padStart(4, "0");
  }
  function getSerialNumber(device) {
    if (device.serialNumber) {
      return device.serialNumber;
    }
    return padNumber(device.vendorId) + "x" + padNumber(device.productId);
  }
  function findUsbEndpoints(endpoints) {
    if (endpoints.length === 0) {
      throw new TypeError("No endpoints given");
    }
    let inEndpoint;
    let outEndpoint;
    for (const endpoint of endpoints) {
      switch (endpoint.direction) {
        case "in":
          inEndpoint = endpoint;
          if (outEndpoint) {
            return { inEndpoint, outEndpoint };
          }
          break;
        case "out":
          outEndpoint = endpoint;
          if (inEndpoint) {
            return { inEndpoint, outEndpoint };
          }
          break;
      }
    }
    if (!inEndpoint) {
      throw new TypeError("No input endpoint found.");
    }
    if (!outEndpoint) {
      throw new TypeError("No output endpoint found.");
    }
    throw new Error("unreachable");
  }
  function matchFilter(device, filter) {
    if (filter.vendorId !== void 0 && device.vendorId !== filter.vendorId) {
      return false;
    }
    if (filter.productId !== void 0 && device.productId !== filter.productId) {
      return false;
    }
    if (filter.serialNumber !== void 0 && getSerialNumber(device) !== filter.serialNumber) {
      return false;
    }
    if (isUsbInterfaceFilter(filter)) {
      return findUsbInterface(device, filter) || false;
    }
    return true;
  }
  function matchFilters(device, filters, exclusionFilters) {
    if (exclusionFilters && exclusionFilters.length > 0) {
      if (matchFilters(device, exclusionFilters)) {
        return false;
      }
    }
    for (const filter of filters) {
      const result = matchFilter(device, filter);
      if (result) {
        return result;
      }
    }
    return false;
  }

  // node_modules/@yume-chan/adb-daemon-webusb/esm/device.js
  var AdbDefaultInterfaceFilter = {
    classCode: 255,
    subclassCode: 66,
    protocolCode: 1
  };
  function mergeDefaultAdbInterfaceFilter(filters) {
    if (!filters || filters.length === 0) {
      return [AdbDefaultInterfaceFilter];
    } else {
      return filters.map((filter) => ({
        ...filter,
        classCode: filter.classCode ?? AdbDefaultInterfaceFilter.classCode,
        subclassCode: filter.subclassCode ?? AdbDefaultInterfaceFilter.subclassCode,
        protocolCode: filter.protocolCode ?? AdbDefaultInterfaceFilter.protocolCode
      }));
    }
  }
  var AdbDaemonWebUsbConnection = class {
    #device;
    get device() {
      return this.#device;
    }
    #inEndpoint;
    get inEndpoint() {
      return this.#inEndpoint;
    }
    #outEndpoint;
    get outEndpoint() {
      return this.#outEndpoint;
    }
    #readable;
    get readable() {
      return this.#readable;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    constructor(device, inEndpoint, outEndpoint, usbManager) {
      this.#device = device;
      this.#inEndpoint = inEndpoint;
      this.#outEndpoint = outEndpoint;
      let closed2 = false;
      const duplex = new DuplexStreamFactory({
        close: async () => {
          try {
            closed2 = true;
            await device.raw.close();
          } catch {
          }
        },
        dispose: () => {
          closed2 = true;
          usbManager.removeEventListener("disconnect", handleUsbDisconnect);
        }
      });
      function handleUsbDisconnect(e) {
        if (e.device === device.raw) {
          duplex.dispose().catch(unreachable);
        }
      }
      usbManager.addEventListener("disconnect", handleUsbDisconnect);
      this.#readable = duplex.wrapReadable(new ReadableStream2({
        pull: async (controller) => {
          const packet = await this.#transferIn();
          if (packet) {
            controller.enqueue(packet);
          } else {
            controller.close();
          }
        }
      }, { highWaterMark: 0 }));
      const zeroMask = outEndpoint.packetSize - 1;
      this.#writable = pipeFrom(duplex.createWritable(new maybe_consumable_exports.WritableStream({
        write: async (chunk) => {
          try {
            await device.raw.transferOut(outEndpoint.endpointNumber, toLocalUint8Array(chunk));
            if (zeroMask && (chunk.length & zeroMask) === 0) {
              await device.raw.transferOut(outEndpoint.endpointNumber, EmptyUint8Array);
            }
          } catch (e) {
            if (closed2) {
              return;
            }
            throw e;
          }
        }
      })), new AdbPacketSerializeStream());
    }
    async #transferIn() {
      try {
        while (true) {
          const result = await this.#device.raw.transferIn(this.#inEndpoint.endpointNumber, this.#inEndpoint.packetSize);
          if (result.data.byteLength !== 24) {
            continue;
          }
          const buffer2 = new Uint8Array(result.data.buffer);
          const stream = new Uint8ArrayExactReadable(buffer2);
          const packet = AdbPacketHeader.deserialize(stream);
          if (packet.magic !== (packet.command ^ 4294967295)) {
            continue;
          }
          if (packet.payloadLength !== 0) {
            const result2 = await this.#device.raw.transferIn(this.#inEndpoint.endpointNumber, packet.payloadLength);
            packet.payload = new Uint8Array(result2.data.buffer);
          } else {
            packet.payload = EmptyUint8Array;
          }
          return packet;
        }
      } catch (e) {
        if (isErrorName(e, "NetworkError")) {
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
          if (closed) {
            return void 0;
          }
        }
        throw e;
      }
    }
  };
  var AdbDaemonWebUsbDevice = class _AdbDaemonWebUsbDevice {
    static DeviceBusyError = DeviceBusyError;
    #interface;
    #usbManager;
    #raw;
    get raw() {
      return this.#raw;
    }
    #serial;
    get serial() {
      return this.#serial;
    }
    get name() {
      return this.#raw.productName;
    }
    /**
     * Create a new instance of `AdbDaemonWebUsbConnection` using a specified `USBDevice` instance
     *
     * @param device The `USBDevice` instance obtained elsewhere.
     * @param filters The filters to use when searching for ADB interface. Defaults to {@link ADB_DEFAULT_DEVICE_FILTER}.
     */
    constructor(device, interface_, usbManager) {
      this.#raw = device;
      this.#serial = getSerialNumber(device);
      this.#interface = interface_;
      this.#usbManager = usbManager;
    }
    async #claimInterface() {
      if (!this.#raw.opened) {
        await this.#raw.open();
      }
      const { configuration, interface_, alternate } = this.#interface;
      if (this.#raw.configuration?.configurationValue !== configuration.configurationValue) {
        await this.#raw.selectConfiguration(configuration.configurationValue);
      }
      if (!interface_.claimed) {
        try {
          await this.#raw.claimInterface(interface_.interfaceNumber);
        } catch (e) {
          if (isErrorName(e, "NetworkError")) {
            throw new _AdbDaemonWebUsbDevice.DeviceBusyError(e);
          }
          throw e;
        }
      }
      if (interface_.alternate.alternateSetting !== alternate.alternateSetting) {
        await this.#raw.selectAlternateInterface(interface_.interfaceNumber, alternate.alternateSetting);
      }
      return findUsbEndpoints(alternate.endpoints);
    }
    /**
     * Open the device and create a new connection to the ADB Daemon.
     */
    async connect() {
      const { inEndpoint, outEndpoint } = await this.#claimInterface();
      return new AdbDaemonWebUsbConnection(this, inEndpoint, outEndpoint, this.#usbManager);
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/observer.js
  var AdbDaemonWebUsbDeviceObserver = class _AdbDaemonWebUsbDeviceObserver {
    static async create(usb, options = {}) {
      const devices = await usb.getDevices();
      return new _AdbDaemonWebUsbDeviceObserver(usb, devices, options);
    }
    #filters;
    #exclusionFilters;
    #usbManager;
    #onDeviceAdd = new EventEmitter();
    onDeviceAdd = this.#onDeviceAdd.event;
    #onDeviceRemove = new EventEmitter();
    onDeviceRemove = this.#onDeviceRemove.event;
    #onListChange = new StickyEventEmitter();
    onListChange = this.#onListChange.event;
    current = [];
    constructor(usb, initial, options = {}) {
      this.#filters = mergeDefaultAdbInterfaceFilter(options.filters);
      this.#exclusionFilters = options.exclusionFilters;
      this.#usbManager = usb;
      this.current = initial.map((device) => this.#convertDevice(device)).filter((device) => !!device);
      this.#onListChange.fire(this.current);
      this.#usbManager.addEventListener("connect", this.#handleConnect);
      this.#usbManager.addEventListener("disconnect", this.#handleDisconnect);
    }
    #convertDevice(device) {
      const interface_ = matchFilters(device, this.#filters, this.#exclusionFilters);
      if (!interface_) {
        return void 0;
      }
      return new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager);
    }
    #handleConnect = (e) => {
      const device = this.#convertDevice(e.device);
      if (!device) {
        return;
      }
      if (this.current.some((item) => item.raw === device.raw)) {
        return;
      }
      const next = this.current.slice();
      next.push(device);
      this.current = next;
      this.#onDeviceAdd.fire([device]);
      this.#onListChange.fire(this.current);
    };
    #handleDisconnect = (e) => {
      const index = this.current.findIndex((device) => device.raw === e.device);
      if (index !== -1) {
        const device = this.current[index];
        const next = this.current.slice();
        unorderedRemove(next, index);
        this.current = next;
        this.#onDeviceRemove.fire([device]);
        this.#onListChange.fire(this.current);
      }
    };
    stop() {
      this.#usbManager.removeEventListener("connect", this.#handleConnect);
      this.#usbManager.removeEventListener("disconnect", this.#handleDisconnect);
      this.#onDeviceAdd.dispose();
      this.#onDeviceRemove.dispose();
      this.#onListChange.dispose();
    }
  };

  // node_modules/@yume-chan/adb-daemon-webusb/esm/manager.js
  var AdbDaemonWebUsbDeviceManager = class _AdbDaemonWebUsbDeviceManager {
    /**
     * Gets the instance of {@link AdbDaemonWebUsbDeviceManager} using browser WebUSB implementation.
     *
     * May be `undefined` if current runtime does not support WebUSB.
     */
    static BROWSER = /* @__PURE__ */ (() => typeof globalThis.navigator !== "undefined" && globalThis.navigator.usb ? new _AdbDaemonWebUsbDeviceManager(globalThis.navigator.usb) : void 0)();
    #usbManager;
    /**
     * Create a new instance of {@link AdbDaemonWebUsbDeviceManager} using the specified WebUSB implementation.
     * @param usbManager A WebUSB compatible interface.
     */
    constructor(usbManager) {
      this.#usbManager = usbManager;
    }
    /**
     * Call `USB#requestDevice()` to prompt the user to select a device.
     */
    async requestDevice(options = {}) {
      const filters = mergeDefaultAdbInterfaceFilter(options.filters);
      try {
        const device = await this.#usbManager.requestDevice({
          filters,
          exclusionFilters: options.exclusionFilters
        });
        const interface_ = matchFilters(device, filters, options.exclusionFilters);
        if (!interface_) {
          return void 0;
        }
        this.#usbManager.dispatchEvent(new USBConnectionEvent("connect", { device }));
        return new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager);
      } catch (e) {
        if (isErrorName(e, "NotFoundError")) {
          return void 0;
        }
        throw e;
      }
    }
    /**
     * Get all connected and requested devices that match the specified filters.
     */
    async getDevices(options = {}) {
      const filters = mergeDefaultAdbInterfaceFilter(options.filters);
      const devices = await this.#usbManager.getDevices();
      const result = [];
      for (const device of devices) {
        const interface_ = matchFilters(device, filters, options.exclusionFilters);
        if (interface_) {
          result.push(new AdbDaemonWebUsbDevice(device, interface_, this.#usbManager));
        }
      }
      return result;
    }
    trackDevices(options = {}) {
      return AdbDaemonWebUsbDeviceObserver.create(this.#usbManager, options);
    }
  };

  // node_modules/@yume-chan/adb-credential-web/esm/index.js
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("Tango", 1);
      request.onerror = () => {
        reject(request.error);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("Authentication", { autoIncrement: true });
      };
      request.onsuccess = () => {
        const db = request.result;
        resolve(db);
      };
    });
  }
  async function saveKey(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("Authentication", "readwrite");
      const store = transaction.objectStore("Authentication");
      const putRequest = store.add(key);
      putRequest.onerror = () => {
        reject(putRequest.error);
      };
      putRequest.onsuccess = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
      };
    });
  }
  async function getAllKeys() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("Authentication", "readonly");
      const store = transaction.objectStore("Authentication");
      const getRequest = store.getAll();
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };
      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
      };
    });
  }
  var AdbWebCredentialStore = class {
    #appName;
    constructor(appName = "Tango") {
      this.#appName = appName;
    }
    /**
     * Generates a RSA private key and store it into LocalStorage.
     *
     * Calling this method multiple times will overwrite the previous key.
     *
     * @returns The private key in PKCS #8 format.
     */
    async generateKey() {
      const { privateKey: cryptoKey } = await crypto.subtle.generateKey({
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        // 65537
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-1"
      }, true, ["sign", "verify"]);
      const privateKey = new Uint8Array(await crypto.subtle.exportKey("pkcs8", cryptoKey));
      await saveKey(privateKey);
      return {
        buffer: privateKey,
        name: `${this.#appName}@${globalThis.location.hostname}`
      };
    }
    /**
     * Yields the stored RSA private key.
     *
     * This method returns a generator, so `for await...of...` loop should be used to read the key.
     */
    async *iterateKeys() {
      for (const key of await getAllKeys()) {
        yield {
          buffer: key,
          name: `${this.#appName}@${globalThis.location.hostname}`
        };
      }
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/audio.js
  var ScrcpyAudioCodec = class _ScrcpyAudioCodec {
    static Opus = /* @__PURE__ */ new _ScrcpyAudioCodec("opus", 1869641075, "audio/opus", "opus");
    static Aac = /* @__PURE__ */ new _ScrcpyAudioCodec("aac", 6381923, "audio/aac", "mp4a.66");
    static Flac = /* @__PURE__ */ new _ScrcpyAudioCodec("flac", 1718378851, "audio/flac", "flac");
    static Raw = /* @__PURE__ */ new _ScrcpyAudioCodec("raw", 7496055, "audio/raw", "");
    optionValue;
    metadataValue;
    mimeType;
    webCodecId;
    constructor(optionValue, metadataValue, mimeType, webCodecId) {
      this.optionValue = optionValue;
      this.metadataValue = metadataValue;
      this.mimeType = mimeType;
      this.webCodecId = webCodecId;
    }
    toOptionValue() {
      return this.optionValue;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/control-message-type.js
  var ScrcpyControlMessageType = {
    InjectKeyCode: 0,
    InjectText: 1,
    InjectTouch: 2,
    InjectScroll: 3,
    BackOrScreenOn: 4,
    ExpandNotificationPanel: 5,
    ExpandSettingPanel: 6,
    CollapseNotificationPanel: 7,
    GetClipboard: 8,
    SetClipboard: 9,
    SetDisplayPower: 10,
    RotateDevice: 11,
    UHidCreate: 12,
    UHidInput: 13,
    UHidDestroy: 14,
    OpenHardKeyboardSettings: 15,
    StartApp: 16,
    ResetVideo: 17
  };

  // node_modules/@yume-chan/scrcpy/esm/base/device-message.js
  var ScrcpyDeviceMessageParsers = class {
    #parsers = [];
    get parsers() {
      return this.#parsers;
    }
    #add(id, parser) {
      if (this.#parsers[id]) {
        throw new Error(`Duplicate parser for id ${id}`);
      }
      this.#parsers[id] = parser;
    }
    add(parser) {
      if (Array.isArray(parser.id)) {
        for (const id of parser.id) {
          this.#add(id, parser);
        }
      } else {
        this.#add(parser.id, parser);
      }
      return parser;
    }
    async parse(id, stream) {
      const parser = this.#parsers[id];
      if (!parser) {
        throw new Error(`Unknown device message id ${id}`);
      }
      return parser.parse(id, stream);
    }
    close() {
      for (const parser of this.#parsers) {
        parser.close();
      }
    }
    error(e) {
      for (const parser of this.#parsers) {
        parser.error(e);
      }
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/base/option-value.js
  function isScrcpyOptionValue(value) {
    return typeof value === "object" && value !== null && "toOptionValue" in value && typeof value.toOptionValue === "function";
  }
  function toScrcpyOptionValue(value, empty) {
    if (isScrcpyOptionValue(value)) {
      value = value.toOptionValue();
    }
    if (value === void 0) {
      return empty;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new TypeError(`Invalid option value: ${JSON.stringify(value)}`);
    }
    return value.toString();
  }

  // node_modules/@yume-chan/scrcpy/esm/base/video.js
  var ScrcpyVideoCodecId = {
    H264: 1748121140,
    H265: 1748121141,
    AV1: 6387249
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/index.js
  var impl_exports = {};
  __export(impl_exports, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes,
    Crop: () => Crop,
    Defaults: () => Defaults,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays
  });

  // node_modules/@yume-chan/scrcpy/esm/android/key-event.js
  var AndroidKeyEventAction = {
    Down: 0,
    Up: 1
  };
  var AndroidKeyCode = {
    AndroidHome: 3,
    AndroidBack: 4,
    AndroidCall: 5,
    AndroidEndCall: 6,
    Digit0: 7,
    Digit1: 8,
    Digit2: 9,
    Digit3: 10,
    Digit4: 11,
    Digit5: 12,
    Digit6: 13,
    Digit7: 14,
    Digit8: 15,
    Digit9: 16,
    /**
     * '*' key.
     */
    Star: 17,
    // Name not verified
    /**
     * '#' key.
     */
    Pound: 18,
    // Name not verified
    /**
     * Directional Pad Up key.
     */
    ArrowUp: 19,
    /**
     * Directional Pad Down key.
     */
    ArrowDown: 20,
    /**
     * Directional Pad Left key.
     */
    ArrowLeft: 21,
    /**
     * Directional Pad Right key.
     */
    ArrowRight: 22,
    /**
     * Directional Pad Center key.
     */
    AndroidDPadCenter: 23,
    VolumeUp: 24,
    // Name not verified
    VolumeDown: 25,
    // Name not verified
    Power: 26,
    // Name not verified
    AndroidCamera: 27,
    Clear: 28,
    // Name not verified
    KeyA: 29,
    KeyB: 30,
    KeyC: 31,
    KeyD: 32,
    KeyE: 33,
    KeyF: 34,
    KeyG: 35,
    KeyH: 36,
    KeyI: 37,
    KeyJ: 38,
    KeyK: 39,
    KeyL: 40,
    KeyM: 41,
    KeyN: 42,
    KeyO: 43,
    KeyP: 44,
    KeyQ: 45,
    KeyR: 46,
    KeyS: 47,
    KeyT: 48,
    KeyU: 49,
    KeyV: 50,
    KeyW: 51,
    KeyX: 52,
    KeyY: 53,
    KeyZ: 54,
    Comma: 55,
    Period: 56,
    AltLeft: 57,
    AltRight: 58,
    ShiftLeft: 59,
    ShiftRight: 60,
    Tab: 61,
    Space: 62,
    AndroidSymbol: 63,
    AndroidExplorer: 64,
    AndroidEnvelope: 65,
    Enter: 66,
    Backspace: 67,
    Backquote: 68,
    Minus: 69,
    Equal: 70,
    BracketLeft: 71,
    BracketRight: 72,
    Backslash: 73,
    Semicolon: 74,
    Quote: 75,
    Slash: 76,
    At: 77,
    // Name not verified
    AndroidNum: 78,
    AndroidHeadsetHook: 79,
    /**
     * Camera Focus key。
     */
    AndroidFocus: 80,
    Plus: 81,
    // Name not verified
    ContextMenu: 82,
    AndroidNotification: 83,
    AndroidSearch: 84,
    PageUp: 92,
    PageDown: 93,
    Escape: 111,
    Delete: 112,
    ControlLeft: 113,
    ControlRight: 114,
    CapsLock: 115,
    ScrollLock: 116,
    MetaLeft: 117,
    MetaRight: 118,
    AndroidFunction: 119,
    PrintScreen: 120,
    Pause: 121,
    Home: 122,
    End: 123,
    Insert: 124,
    AndroidForward: 125,
    F1: 131,
    F2: 132,
    F3: 133,
    F4: 134,
    F5: 135,
    F6: 136,
    F7: 137,
    F8: 138,
    F9: 139,
    F10: 140,
    F11: 141,
    F12: 142,
    NumLock: 143,
    Numpad0: 144,
    Numpad1: 145,
    Numpad2: 146,
    Numpad3: 147,
    Numpad4: 148,
    Numpad5: 149,
    Numpad6: 150,
    Numpad7: 151,
    Numpad8: 152,
    Numpad9: 153,
    NumpadDivide: 154,
    NumpadMultiply: 155,
    NumpadSubtract: 156,
    NumpadAdd: 157,
    NumpadDecimal: 158,
    NumpadComma: 159,
    // Name not verified
    NumpadEnter: 160,
    NumpadEquals: 161,
    // Name not verified
    NumpadLeftParen: 162,
    // Name not verified
    NumpadRightParen: 163,
    // Name not verified
    VolumeMute: 164,
    // Name not verified
    AndroidAppSwitch: 187,
    // Name not verified
    AndroidCut: 277,
    AndroidCopy: 278,
    AndroidPaste: 279
  };

  // node_modules/@yume-chan/scrcpy/esm/android/motion-event.js
  var AndroidMotionEventAction = {
    Down: 0,
    Up: 1,
    Move: 2,
    Cancel: 3,
    Outside: 4,
    PointerDown: 5,
    PointerUp: 6,
    HoverMove: 7,
    Scroll: 8,
    HoverEnter: 9,
    HoverExit: 10,
    ButtonPress: 11,
    ButtonRelease: 12
  };
  var AndroidMotionEventButton = {
    None: 0,
    Primary: 1,
    Secondary: 2,
    Tertiary: 4,
    Back: 8,
    Forward: 16,
    StylusPrimary: 32,
    StylusSecondary: 64
  };

  // node_modules/@yume-chan/scrcpy/esm/android/screen-power-mode.js
  var AndroidScreenPowerMode = {
    Off: 0,
    Normal: 2
  };

  // node_modules/@yume-chan/scrcpy/esm/control/empty.js
  var EmptyControlMessage = struct({ type: u8 }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/inject-key-code.js
  var ScrcpyInjectKeyCodeControlMessage = /* @__PURE__ */ (() => struct({
    type: u8(ScrcpyControlMessageType.InjectKeyCode),
    action: u8(),
    keyCode: u32(),
    repeat: u32,
    metaState: u32()
  }, { littleEndian: false }))();

  // node_modules/@yume-chan/scrcpy/esm/control/inject-text.js
  var ScrcpyInjectTextControlMessage = struct({ type: u8, text: string(u32) }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/message-type-map.js
  var ScrcpyControlMessageTypeMap = class {
    #types;
    constructor(options) {
      this.#types = options.controlMessageTypes;
    }
    get(type) {
      const value = this.#types.indexOf(type);
      if (value === -1) {
        throw new TypeError("Invalid or unsupported control message type");
      }
      return value;
    }
    fillMessageType(message, type) {
      message.type = this.get(type);
      return message;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/control/set-screen-power-mode.js
  var ScrcpySetDisplayPowerControlMessage = struct({ type: u8, mode: u8() }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/start-app.js
  var ScrcpyStartAppControlMessage = struct({
    type: u8,
    name: string(u8)
  }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/uhid.js
  var ScrcpyUHidInputControlMessage = /* @__PURE__ */ (() => struct({
    type: u8(ScrcpyControlMessageType.UHidInput),
    id: u16,
    data: buffer(u16)
  }, { littleEndian: false }))();
  var ScrcpyUHidDestroyControlMessage = struct({ type: u8, id: u16 }, { littleEndian: false });

  // node_modules/@yume-chan/scrcpy/esm/control/serializer.js
  var ScrcpyControlMessageSerializer = class {
    #options;
    #typeMap;
    #scrollController;
    constructor(options) {
      this.#options = options;
      this.#typeMap = new ScrcpyControlMessageTypeMap(options);
      this.#scrollController = options.createScrollController();
    }
    injectKeyCode(message) {
      return ScrcpyInjectKeyCodeControlMessage.serialize(this.#typeMap.fillMessageType(message, ScrcpyControlMessageType.InjectKeyCode));
    }
    injectText(text) {
      return ScrcpyInjectTextControlMessage.serialize({
        text,
        type: this.#typeMap.get(ScrcpyControlMessageType.InjectText)
      });
    }
    /**
     * `pressure` is a float value between 0 and 1.
     */
    injectTouch(message) {
      return this.#options.serializeInjectTouchControlMessage(this.#typeMap.fillMessageType(message, ScrcpyControlMessageType.InjectTouch));
    }
    /**
     * `scrollX` and `scrollY` are float values between 0 and 1.
     */
    injectScroll(message) {
      return this.#scrollController.serializeScrollMessage(this.#typeMap.fillMessageType(message, ScrcpyControlMessageType.InjectScroll));
    }
    backOrScreenOn(action) {
      return this.#options.serializeBackOrScreenOnControlMessage({
        action,
        type: this.#typeMap.get(ScrcpyControlMessageType.BackOrScreenOn)
      });
    }
    setDisplayPower(mode2) {
      return ScrcpySetDisplayPowerControlMessage.serialize({
        mode: mode2,
        type: this.#typeMap.get(ScrcpyControlMessageType.SetDisplayPower)
      });
    }
    expandNotificationPanel() {
      return EmptyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.ExpandNotificationPanel)
      });
    }
    expandSettingPanel() {
      return EmptyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.ExpandSettingPanel)
      });
    }
    collapseNotificationPanel() {
      return EmptyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.CollapseNotificationPanel)
      });
    }
    rotateDevice() {
      return EmptyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.RotateDevice)
      });
    }
    setClipboard(message) {
      return this.#options.serializeSetClipboardControlMessage({
        ...message,
        type: this.#typeMap.get(ScrcpyControlMessageType.SetClipboard)
      });
    }
    uHidCreate(message) {
      if (!this.#options.serializeUHidCreateControlMessage) {
        throw new Error("UHid not supported");
      }
      return this.#options.serializeUHidCreateControlMessage(this.#typeMap.fillMessageType(message, ScrcpyControlMessageType.UHidCreate));
    }
    uHidInput(message) {
      return ScrcpyUHidInputControlMessage.serialize(this.#typeMap.fillMessageType(message, ScrcpyControlMessageType.UHidInput));
    }
    uHidDestroy(id) {
      return ScrcpyUHidDestroyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.UHidDestroy),
        id
      });
    }
    startApp(name, options) {
      if (options?.searchByName) {
        name = "?" + name;
      }
      if (options?.forceStop) {
        name = "+" + name;
      }
      return ScrcpyStartAppControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.StartApp),
        name
      });
    }
    resetVideo() {
      return EmptyControlMessage.serialize({
        type: this.#typeMap.get(ScrcpyControlMessageType.ResetVideo)
      });
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/control/writer.js
  var ScrcpyControlMessageWriter = class {
    #writer;
    #serializer;
    constructor(writer, options) {
      this.#writer = writer;
      this.#serializer = new ScrcpyControlMessageSerializer(options);
    }
    write(message) {
      return Consumable.WritableStream.write(this.#writer, message);
    }
    injectKeyCode(message) {
      return this.write(this.#serializer.injectKeyCode(message));
    }
    injectText(text) {
      return this.write(this.#serializer.injectText(text));
    }
    /**
     * `pressure` is a float value between 0 and 1.
     */
    injectTouch(message) {
      return this.write(this.#serializer.injectTouch(message));
    }
    /**
     * `scrollX` and `scrollY` are float values between 0 and 1.
     */
    async injectScroll(message) {
      const data = this.#serializer.injectScroll(message);
      if (data) {
        await this.write(data);
      }
    }
    async backOrScreenOn(action) {
      const data = this.#serializer.backOrScreenOn(action);
      if (data) {
        await this.write(data);
      }
    }
    setScreenPowerMode(mode2) {
      return this.write(this.#serializer.setDisplayPower(mode2));
    }
    expandNotificationPanel() {
      return this.write(this.#serializer.expandNotificationPanel());
    }
    expandSettingPanel() {
      return this.write(this.#serializer.expandSettingPanel());
    }
    collapseNotificationPanel() {
      return this.write(this.#serializer.collapseNotificationPanel());
    }
    rotateDevice() {
      return this.write(this.#serializer.rotateDevice());
    }
    async setClipboard(message) {
      const result = this.#serializer.setClipboard(message);
      if (result instanceof Uint8Array) {
        await this.write(result);
      } else {
        await this.write(result[0]);
        await result[1];
      }
    }
    uHidCreate(message) {
      return this.write(this.#serializer.uHidCreate(message));
    }
    uHidInput(message) {
      return this.write(this.#serializer.uHidInput(message));
    }
    uHidDestroy(id) {
      return this.write(this.#serializer.uHidDestroy(id));
    }
    startApp(name, options) {
      return this.write(this.#serializer.startApp(name, options));
    }
    resetVideo() {
      return this.write(this.#serializer.resetVideo());
    }
    releaseLock() {
      this.#writer.releaseLock();
    }
    async close() {
      await this.#writer.close();
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/back-or-screen-on.js
  var BackOrScreenOnControlMessage = EmptyControlMessage;
  function serializeBackOrScreenOnControlMessage(message) {
    if (message.action === AndroidKeyEventAction.Down) {
      return BackOrScreenOnControlMessage.serialize(message);
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/clipboard-stream.js
  var ClipboardDeviceMessage = struct({ content: string(u32) }, { littleEndian: false });
  var ClipboardStream = class extends PushReadableStream {
    #controller;
    id = 0;
    constructor() {
      let controller;
      super((controller_) => {
        controller = controller_;
      });
      this.#controller = controller;
    }
    async parse(_id, stream) {
      const message = await ClipboardDeviceMessage.deserialize(stream);
      await this.#controller.enqueue(message.content);
    }
    close() {
      this.#controller.close();
    }
    error(e) {
      this.#controller.error(e);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/control-message-types.js
  var ControlMessageTypes = /* @__PURE__ */ (() => [
    /*  0 */
    ScrcpyControlMessageType.InjectKeyCode,
    /*  1 */
    ScrcpyControlMessageType.InjectText,
    /*  2 */
    ScrcpyControlMessageType.InjectTouch,
    /*  3 */
    ScrcpyControlMessageType.InjectScroll,
    /*  4 */
    ScrcpyControlMessageType.BackOrScreenOn,
    /*  5 */
    ScrcpyControlMessageType.ExpandNotificationPanel,
    /*  6 */
    ScrcpyControlMessageType.CollapseNotificationPanel,
    /*  7 */
    ScrcpyControlMessageType.GetClipboard,
    /*  8 */
    ScrcpyControlMessageType.SetClipboard,
    /*  9 */
    ScrcpyControlMessageType.SetDisplayPower,
    /* 10 */
    ScrcpyControlMessageType.RotateDevice
  ])();

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/init.js
  var VideoOrientation = {
    Unlocked: -1,
    Portrait: 0,
    Landscape: 1,
    PortraitFlipped: 2,
    LandscapeFlipped: 3
  };
  function toDashCase(input) {
    return input.replace(/([A-Z])/g, "-$1").toLowerCase();
  }
  var CodecOptionTypes = {
    repeatPreviousFrameAfter: "long",
    maxPtsGapToEncoder: "long"
  };
  var CodecOptions = class _CodecOptions {
    static Empty = /* @__PURE__ */ new _CodecOptions();
    options;
    constructor(options = {}) {
      for (const [key, value] of Object.entries(options)) {
        if (value === void 0) {
          continue;
        }
        if (typeof value !== "number") {
          throw new Error(`Invalid option value for ${key}: ${String(value)}`);
        }
      }
      this.options = options;
    }
    toOptionValue() {
      const entries = Object.entries(this.options).filter(([, value]) => value !== void 0);
      if (entries.length === 0) {
        return void 0;
      }
      return entries.map(([key, value]) => {
        let result = toDashCase(key);
        const type = CodecOptionTypes[key];
        if (type) {
          result += `:${type}`;
        }
        result += `=${value}`;
        return result;
      }).join(",");
    }
  };
  var Crop = class {
    width;
    height;
    x;
    y;
    constructor(width, height, x, y) {
      this.width = width;
      this.height = height;
      this.x = x;
      this.y = y;
    }
    toOptionValue() {
      return `${this.width}:${this.height}:${this.x}:${this.y}`;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/defaults.js
  var Defaults = {
    logLevel: "debug",
    maxSize: 0,
    bitRate: 8e6,
    maxFps: 0,
    lockVideoOrientation: VideoOrientation.Unlocked,
    tunnelForward: false,
    crop: void 0,
    sendFrameMeta: true,
    control: true,
    displayId: 0,
    showTouches: false,
    stayAwake: false,
    codecOptions: void 0
  };

  // node_modules/@yume-chan/scrcpy/esm/utils/clamp.js
  function clamp(value, min, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  // node_modules/@yume-chan/scrcpy/esm/utils/constants.js
  var DefaultServerPath = "/data/local/tmp/scrcpy-server.jar";

  // node_modules/@yume-chan/scrcpy/esm/utils/omit.js
  // @__NO_SIDE_EFFECTS__
  function omit(value, ...keys) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/inject-touch.js
  var UnsignedFloat = field(2, "byob", (source, { buffer: buffer2, index, littleEndian }) => {
    source = clamp(source, -1, 1);
    source = source === 1 ? 65535 : source * 65536;
    setUint16(buffer2, index, source, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    const value = getUint16(data, 0, littleEndian);
    return value === 65535 ? 1 : value / 65536;
  });
  var PointerId = {
    Mouse: -1n,
    Finger: -2n,
    VirtualMouse: -3n,
    VirtualFinger: -4n
  };
  var InjectTouchControlMessage = struct({
    type: u8,
    action: u8(),
    pointerId: u64,
    pointerX: u32,
    pointerY: u32,
    videoWidth: u16,
    videoHeight: u16,
    pressure: UnsignedFloat,
    buttons: u32
  }, { littleEndian: false });
  function serializeInjectTouchControlMessage(message) {
    return InjectTouchControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/media-stream-transformer.js
  var MediaStreamRawPacket = struct({ pts: u64, data: buffer(u32) }, { littleEndian: false });
  var PtsConfig = 1n << 63n;
  function createMediaStreamTransformer(options) {
    if (!options.sendFrameMeta) {
      return new TransformStream2({
        transform(chunk, controller) {
          controller.enqueue({
            type: "data",
            data: chunk
          });
        }
      });
    }
    const deserializeStream = new StructDeserializeStream(MediaStreamRawPacket);
    return {
      writable: deserializeStream.writable,
      readable: deserializeStream.readable.pipeThrough(new TransformStream2({
        transform(packet, controller) {
          if (packet.pts === PtsConfig) {
            controller.enqueue({
              type: "configuration",
              data: packet.data
            });
            return;
          }
          controller.enqueue({
            type: "data",
            pts: packet.pts,
            data: packet.data
          });
        }
      }))
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/parse-display.js
  function parseDisplay(line) {
    const match = line.match(/^\s+scrcpy --display (\d+)$/);
    if (match) {
      return {
        id: Number.parseInt(match[1], 10)
      };
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/parse-video-stream-metadata.js
  async function readString(stream, maxLength) {
    const buffer2 = await stream.readExactly(maxLength);
    return decodeUtf8(buffer2.subarray(0, buffer2.indexOf(0)));
  }
  async function readU16(stream) {
    const buffer2 = await stream.readExactly(2);
    return getUint16BigEndian(buffer2, 0);
  }
  async function readU32(stream) {
    const buffer2 = await stream.readExactly(4);
    return getUint32BigEndian(buffer2, 0);
  }
  async function parseVideoStreamMetadata(stream) {
    const buffered = new BufferedReadableStream(stream);
    const metadata = {
      codec: ScrcpyVideoCodecId.H264
    };
    metadata.deviceName = await readString(buffered, 64);
    metadata.width = await readU16(buffered);
    metadata.height = await readU16(buffered);
    return { stream: buffered.release(), metadata };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/scroll-controller.js
  var InjectScrollControlMessage = struct({
    type: u8,
    pointerX: u32,
    pointerY: u32,
    videoWidth: u16,
    videoHeight: u16,
    scrollX: s32,
    scrollY: s32
  }, { littleEndian: false });
  var ScrollController = class {
    #accumulatedX = 0;
    #accumulatedY = 0;
    processMessage(message) {
      if (message.scrollX) {
        if (Math.sign(message.scrollX) !== Math.sign(this.#accumulatedX)) {
          this.#accumulatedX = message.scrollX;
        } else {
          this.#accumulatedX += message.scrollX;
        }
      }
      if (message.scrollY) {
        if (Math.sign(message.scrollY) !== Math.sign(this.#accumulatedY)) {
          this.#accumulatedY = message.scrollY;
        } else {
          this.#accumulatedY += message.scrollY;
        }
      }
      const integerX = this.#accumulatedX | 0;
      this.#accumulatedX -= integerX;
      const integerY = this.#accumulatedY | 0;
      this.#accumulatedY -= integerY;
      if (integerX === 0 && integerY === 0) {
        return void 0;
      }
      message.scrollX = integerX;
      message.scrollY = integerY;
      return message;
    }
    serializeScrollMessage(message) {
      const processed = this.processMessage(message);
      if (!processed) {
        return void 0;
      }
      return InjectScrollControlMessage.serialize(processed);
    }
  };
  function createScrollController() {
    return new ScrollController();
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/serialize-order.js
  var SerializeOrder = [
    "logLevel",
    "maxSize",
    "bitRate",
    "maxFps",
    "lockVideoOrientation",
    "tunnelForward",
    "crop",
    "sendFrameMeta",
    "control",
    "displayId",
    "showTouches",
    "stayAwake",
    "codecOptions"
  ];

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/serialize.js
  function serialize(options, order) {
    return order.map((key) => toScrcpyOptionValue(options[key], "-"));
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/set-clipboard.js
  var SetClipboardControlMessage = struct({ type: u8, content: string(u32) }, { littleEndian: false });
  function serializeSetClipboardControlMessage(message) {
    return SetClipboardControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_15/impl/set-list-display.js
  function setListDisplays(options) {
    options.displayId = -1;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/index.js
  var impl_exports2 = {};
  __export(impl_exports2, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes,
    Crop: () => Crop,
    Defaults: () => Defaults2,
    EncoderRegex: () => EncoderRegex,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder2,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/defaults.js
  var Defaults2 = /* @__PURE__ */ (() => ({
    ...impl_exports.Defaults,
    encoderName: void 0
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/parse-encoder.js
  function parseEncoder(line, encoderNameRegex) {
    const match = line.match(encoderNameRegex);
    if (match) {
      return { type: "video", name: match[1] };
    }
    return void 0;
  }
  var EncoderRegex = /^\s+scrcpy --encoder-name '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/serialize-order.js
  var SerializeOrder2 = /* @__PURE__ */ (() => [
    ...impl_exports.SerializeOrder,
    "encoderName"
  ])();

  // node_modules/@yume-chan/scrcpy/esm/1_17/impl/set-list-encoder.js
  function setListEncoders(options) {
    options.encoderName = "_";
  }

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/index.js
  var impl_exports3 = {};
  __export(impl_exports3, {
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults3,
    EncoderRegex: () => EncoderRegex2,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/back-or-screen-on.js
  var BackOrScreenOnControlMessage2 = extend(impl_exports2.BackOrScreenOnControlMessage, { action: u8() });
  function serializeBackOrScreenOnControlMessage2(message) {
    return BackOrScreenOnControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/control-message-types.js
  var ControlMessageTypes2 = /* @__PURE__ */ (() => {
    const result = impl_exports2.ControlMessageTypes.slice();
    result.splice(6, 0, ScrcpyControlMessageType.ExpandSettingPanel);
    return result;
  })();

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/init.js
  var VideoOrientation2 = {
    Initial: -2,
    Unlocked: -1,
    Portrait: 0,
    Landscape: 1,
    PortraitFlipped: 2,
    LandscapeFlipped: 3
  };

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/defaults.js
  var Defaults3 = /* @__PURE__ */ (() => ({
    ...impl_exports2.Defaults,
    logLevel: "debug",
    lockVideoOrientation: VideoOrientation2.Unlocked,
    powerOffOnClose: false
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/parse-encoder.js
  var EncoderRegex2 = /^\s+scrcpy --encoder '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_18/impl/serialize-order.js
  var SerializeOrder3 = /* @__PURE__ */ (() => [
    ...impl_exports2.SerializeOrder,
    "powerOffOnClose"
  ])();

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/index.js
  var impl_exports4 = {};
  __export(impl_exports4, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults4,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/defaults.js
  var Defaults4 = /* @__PURE__ */ (() => ({
    ...impl_exports3.Defaults,
    clipboardAutosync: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/parse-encoder.js
  var EncoderRegex3 = /^\s+scrcpy --encoder-name '([^']+)'$/;

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/serialize.js
  function toSnakeCase(input) {
    return input.replace(/([A-Z])/g, "_$1").toLowerCase();
  }
  function serialize2(options, defaults) {
    const result = [];
    for (const [key, value] of Object.entries(options)) {
      const serializedValue = toScrcpyOptionValue(value, void 0);
      if (serializedValue === void 0) {
        continue;
      }
      const defaultValue = toScrcpyOptionValue(defaults[key], void 0);
      if (serializedValue === defaultValue) {
        continue;
      }
      result.push(`${toSnakeCase(key)}=${serializedValue}`);
    }
    return result;
  }

  // node_modules/@yume-chan/scrcpy/esm/1_21/impl/set-clipboard.js
  var AckClipboardDeviceMessage = struct({ sequence: u64 }, { littleEndian: false });
  var SetClipboardControlMessage2 = struct({
    type: u8,
    sequence: u64,
    paste: u8(),
    content: string(u32)
  }, { littleEndian: false });
  var AckClipboardHandler = class {
    #resolvers = /* @__PURE__ */ new Map();
    #closed = false;
    id = 1;
    async parse(_id, stream) {
      const message = await AckClipboardDeviceMessage.deserialize(stream);
      const resolver = this.#resolvers.get(message.sequence);
      if (resolver) {
        resolver.resolve();
        this.#resolvers.delete(message.sequence);
      }
    }
    close() {
      for (const resolver of this.#resolvers.values()) {
        resolver.reject();
      }
      this.#resolvers.clear();
      this.#closed = true;
    }
    error(e) {
      for (const resolver of this.#resolvers.values()) {
        resolver.reject(e);
      }
      this.#resolvers.clear();
      this.#closed = true;
    }
    serializeSetClipboardControlMessage(message) {
      if (message.sequence === 0n) {
        return SetClipboardControlMessage2.serialize(message);
      }
      if (this.#closed) {
        throw new Error();
      }
      const resolver = new PromiseResolver();
      this.#resolvers.set(message.sequence, resolver);
      return [
        SetClipboardControlMessage2.serialize(message),
        resolver.promise
      ];
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/index.js
  var impl_exports5 = {};
  __export(impl_exports5, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults5,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage2,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    ScrollController: () => ScrollController2,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer,
    createScrollController: () => createScrollController2,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/defaults.js
  var Defaults5 = /* @__PURE__ */ (() => ({
    ...impl_exports4.Defaults,
    downsizeOnError: true,
    sendDeviceMeta: true,
    sendDummyByte: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/parse-video-stream-metadata.js
  async function parseVideoStreamMetadata2(options, stream) {
    if (!options.sendDeviceMeta) {
      return { stream, metadata: { codec: ScrcpyVideoCodecId.H264 } };
    } else {
      return impl_exports4.parseVideoStreamMetadata(stream);
    }
  }

  // node_modules/@yume-chan/scrcpy/esm/1_22/impl/scroll-controller.js
  var InjectScrollControlMessage2 = extend(impl_exports4.InjectScrollControlMessage, { buttons: s32 });
  var ScrollController2 = class extends impl_exports4.ScrollController {
    serializeScrollMessage(message) {
      const processed = this.processMessage(message);
      if (!processed) {
        return void 0;
      }
      return InjectScrollControlMessage2.serialize(processed);
    }
  };
  function createScrollController2() {
    return new ScrollController2();
  }

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/index.js
  var impl_exports6 = {};
  __export(impl_exports6, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults6,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage2,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController2,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController2,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/defaults.js
  var Defaults6 = /* @__PURE__ */ (() => ({
    ...impl_exports5.Defaults,
    cleanup: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_23/impl/media-stream-transformer.js
  var PtsKeyframe = 1n << 62n;
  function createMediaStreamTransformer2(options) {
    if (!options.sendFrameMeta) {
      return new TransformStream2({
        transform(chunk, controller) {
          controller.enqueue({
            type: "data",
            data: chunk
          });
        }
      });
    }
    const deserializeStream = new StructDeserializeStream(impl_exports5.MediaStreamRawPacket);
    return {
      writable: deserializeStream.writable,
      readable: deserializeStream.readable.pipeThrough(new TransformStream2({
        transform(packet, controller) {
          if (packet.pts === impl_exports5.PtsConfig) {
            controller.enqueue({
              type: "configuration",
              data: packet.data
            });
            return;
          }
          if (packet.pts & PtsKeyframe) {
            controller.enqueue({
              type: "data",
              keyframe: true,
              pts: packet.pts & ~PtsKeyframe,
              data: packet.data
            });
            return;
          }
          controller.enqueue({
            type: "data",
            keyframe: false,
            pts: packet.pts,
            data: packet.data
          });
        }
      }))
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/1_24/impl/defaults.js
  var Defaults7 = /* @__PURE__ */ (() => ({
    ...impl_exports6.Defaults,
    powerOn: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/1_25/impl/index.js
  var impl_exports7 = {};
  __export(impl_exports7, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults7,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseDisplay: () => parseDisplay,
    parseEncoder: () => parseEncoder,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata2,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays,
    setListEncoders: () => setListEncoders
  });

  // node_modules/@yume-chan/scrcpy/esm/1_25/impl/scroll-controller.js
  var SignedFloat = field(2, "byob", (value, { buffer: buffer2, index, littleEndian }) => {
    value = clamp(value, -1, 1);
    value = value === 1 ? 32767 : value * 32768;
    setInt16(buffer2, index, value, littleEndian);
  }, function* (then, reader, { littleEndian }) {
    const data = yield* then(reader.readExactly(2));
    const value = getInt16(data, 0, littleEndian);
    return value === 32767 ? 1 : value / 32768;
  });
  var InjectScrollControlMessage3 = /* @__PURE__ */ (() => struct({
    type: u8(ScrcpyControlMessageType.InjectScroll),
    pointerX: u32,
    pointerY: u32,
    videoWidth: u16,
    videoHeight: u16,
    scrollX: SignedFloat,
    scrollY: SignedFloat,
    buttons: u32
  }, { littleEndian: false }))();
  var ScrollController3 = class {
    serializeScrollMessage(message) {
      return InjectScrollControlMessage3.serialize(message);
    }
  };
  function createScrollController3() {
    return new ScrollController3();
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/index.js
  var impl_exports8 = {};
  __export(impl_exports8, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults8,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay2,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/defaults.js
  var Defaults8 = /* @__PURE__ */ (() => ({
    ...omit(impl_exports7.Defaults, "bitRate", "codecOptions", "encoderName"),
    scid: void 0,
    videoCodec: "h264",
    videoBitRate: 8e6,
    videoCodecOptions: void 0,
    videoEncoder: void 0,
    audio: true,
    audioCodec: "opus",
    audioBitRate: 128e3,
    audioCodecOptions: void 0,
    audioEncoder: void 0,
    listEncoders: false,
    listDisplays: false,
    sendCodecMeta: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/init.js
  var InstanceId = class _InstanceId {
    static NONE = /* @__PURE__ */ new _InstanceId(-1);
    static random() {
      return new _InstanceId(Math.random() * 2147483648 | 0);
    }
    value;
    constructor(value) {
      this.value = value;
    }
    toOptionValue() {
      if (this.value < 0) {
        return void 0;
      }
      return this.value.toString(16);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/inject-touch.js
  var InjectTouchControlMessage2 = /* @__PURE__ */ (() => struct({
    type: u8(ScrcpyControlMessageType.InjectTouch),
    action: u8(),
    pointerId: u64,
    pointerX: u32,
    pointerY: u32,
    videoWidth: u16,
    videoHeight: u16,
    pressure: impl_exports7.UnsignedFloat,
    actionButton: u32,
    buttons: u32
  }, { littleEndian: false }))();
  function serializeInjectTouchControlMessage2(message) {
    return InjectTouchControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-audio-stream-metadata.js
  async function parseAudioStreamMetadata(stream, options) {
    const buffered = new BufferedReadableStream(stream);
    const buffer2 = await buffered.readExactly(4);
    const codecMetadataValue = getUint32BigEndian(buffer2, 0);
    switch (codecMetadataValue) {
      case 0:
        return {
          type: "disabled"
        };
      case 1:
        return {
          type: "errored"
        };
    }
    if (options.sendCodecMeta) {
      let codec2;
      switch (codecMetadataValue) {
        case ScrcpyAudioCodec.Raw.metadataValue:
          codec2 = ScrcpyAudioCodec.Raw;
          break;
        case ScrcpyAudioCodec.Opus.metadataValue:
          codec2 = ScrcpyAudioCodec.Opus;
          break;
        case ScrcpyAudioCodec.Aac.metadataValue:
          codec2 = ScrcpyAudioCodec.Aac;
          break;
        case ScrcpyAudioCodec.Flac.metadataValue:
          codec2 = ScrcpyAudioCodec.Flac;
          break;
        default:
          throw new Error(`Unknown audio codec metadata value: ${codecMetadataValue}`);
      }
      return {
        type: "success",
        codec: codec2,
        stream: buffered.release()
      };
    }
    let codec;
    switch (options.audioCodec) {
      case "raw":
        codec = ScrcpyAudioCodec.Raw;
        break;
      case "opus":
        codec = ScrcpyAudioCodec.Opus;
        break;
      case "aac":
        codec = ScrcpyAudioCodec.Aac;
        break;
      case "flac":
        codec = ScrcpyAudioCodec.Flac;
        break;
      default:
        throw new Error(`Unknown audio codec metadata value: ${codecMetadataValue}`);
    }
    return {
      type: "success",
      codec,
      stream: new PushReadableStream(async (controller) => {
        await controller.enqueue(buffer2);
        const stream2 = buffered.release();
        const reader = stream2.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          await controller.enqueue(value);
        }
      })
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-display.js
  function parseDisplay2(line) {
    const match = line.match(/^\s+--display=(\d+)\s+\(([^)]+)\)$/);
    if (match) {
      const display = {
        id: Number.parseInt(match[1], 10)
      };
      if (match[2] !== "size unknown") {
        display.resolution = match[2];
      }
      return display;
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-encoder.js
  var EncoderRegex4 = /^\s+--(video|audio)-codec=(\S+)\s+--\1-encoder='([^']+)'$/;
  function parseEncoder2(line) {
    const match = line.match(EncoderRegex4);
    return match ? {
      type: match[1],
      name: match[3],
      codec: match[2]
    } : void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/parse-video-stream-metadata.js
  function toCodecId(codec) {
    switch (codec) {
      case "h264":
        return ScrcpyVideoCodecId.H264;
      case "h265":
        return ScrcpyVideoCodecId.H265;
      case "av1":
        return ScrcpyVideoCodecId.AV1;
      default:
        throw new Error(`Unknown video codec: ${codec}`);
    }
  }
  async function parseAsync(options, stream) {
    const buffered = new BufferedReadableStream(stream);
    let deviceName;
    if (options.sendDeviceMeta) {
      deviceName = await impl_exports7.readString(buffered, 64);
    }
    let codec;
    let width;
    let height;
    if (options.sendCodecMeta) {
      codec = await impl_exports7.readU32(buffered);
      width = await impl_exports7.readU32(buffered);
      height = await impl_exports7.readU32(buffered);
    } else {
      codec = toCodecId(options.videoCodec);
    }
    return {
      stream: buffered.release(),
      metadata: { deviceName, codec, width, height }
    };
  }
  function parseVideoStreamMetadata3(options, stream) {
    if (!options.sendDeviceMeta && !options.sendCodecMeta) {
      return {
        stream,
        metadata: { codec: toCodecId(options.videoCodec) }
      };
    }
    return parseAsync(options, stream);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/set-list-display.js
  function setListDisplays2(options) {
    options.listDisplays = true;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_0/impl/set-list-encoder.js
  function setListEncoders2(options) {
    options.listEncoders = true;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_1/impl/index.js
  var impl_exports9 = {};
  __export(impl_exports9, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults9,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay2,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_1/impl/defaults.js
  var Defaults9 = /* @__PURE__ */ (() => ({
    ...impl_exports8.Defaults,
    video: true,
    audioSource: "output"
  }))();

  // node_modules/@yume-chan/scrcpy/esm/2_2/impl/defaults.js
  var Defaults10 = /* @__PURE__ */ (() => ({
    ...impl_exports9.Defaults,
    videoSource: "display",
    displayId: 0,
    cameraId: void 0,
    cameraSize: void 0,
    cameraFacing: void 0,
    cameraAr: void 0,
    cameraFps: void 0,
    cameraHighSpeed: false,
    listCameras: false,
    listCameraSizes: false
  }))();

  // node_modules/@yume-chan/scrcpy/esm/2_2/impl/parse-display.js
  function parseDisplay3(line) {
    const match = line.match(/^\s+--display-id=(\d+)\s+\(([^)]+)\)$/);
    if (match) {
      const display = {
        id: Number.parseInt(match[1], 10)
      };
      if (match[2] !== "size unknown") {
        display.resolution = match[2];
      }
      return display;
    }
    return void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/2_3/impl/index.js
  var impl_exports10 = {};
  __export(impl_exports10, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes2,
    Crop: () => Crop,
    Defaults: () => Defaults10,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/index.js
  var impl_exports11 = {};
  __export(impl_exports11, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes3,
    Crop: () => Crop,
    Defaults: () => Defaults10,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/control-message-types.js
  var ControlMessageTypes3 = /* @__PURE__ */ (() => [
    ...impl_exports10.ControlMessageTypes,
    ScrcpyControlMessageType.UHidCreate,
    ScrcpyControlMessageType.UHidInput,
    ScrcpyControlMessageType.OpenHardKeyboardSettings
  ])();

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/serialize-uhid-create.js
  var UHidCreateControlMessage = struct({
    type: u8,
    id: u16,
    data: buffer(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage(message) {
    return UHidCreateControlMessage.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/2_4/impl/uhid-output-stream.js
  var UHidOutputDeviceMessage = struct({
    id: u16,
    data: buffer(u16)
  }, { littleEndian: false });
  var UHidOutputStream = class extends PushReadableStream {
    #controller;
    id = 2;
    constructor() {
      let controller;
      super((controller_) => {
        controller = controller_;
      });
      this.#controller = controller;
    }
    async parse(_id, stream) {
      const message = await UHidOutputDeviceMessage.deserialize(stream);
      await this.#controller.enqueue(message);
    }
    close() {
      this.#controller.close();
    }
    error(e) {
      this.#controller.error(e);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/2_6/impl/index.js
  var impl_exports12 = {};
  __export(impl_exports12, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes3,
    Crop: () => Crop,
    Defaults: () => Defaults11,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_6/impl/defaults.js
  var Defaults11 = /* @__PURE__ */ (() => ({
    ...impl_exports11.Defaults,
    audioDup: false
  }))();

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/index.js
  var impl_exports13 = {};
  __export(impl_exports13, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes4,
    Crop: () => Crop,
    Defaults: () => Defaults11,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage2,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder2,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage2,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/control-message-types.js
  var ControlMessageTypes4 = /* @__PURE__ */ (() => {
    const result = impl_exports12.ControlMessageTypes.slice();
    result.splice(14, 0, ScrcpyControlMessageType.UHidDestroy);
    return result;
  })();

  // node_modules/@yume-chan/scrcpy/esm/2_7/impl/serialize-uhid-create.js
  var UHidCreateControlMessage2 = struct({
    type: u8,
    id: u16,
    name: string(u8),
    data: buffer(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage2(message) {
    return UHidCreateControlMessage2.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/index.js
  var impl_exports14 = {};
  __export(impl_exports14, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults12,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage2,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage2,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/control-message-types.js
  var ControlMessageTypes5 = /* @__PURE__ */ (() => [
    ...impl_exports13.ControlMessageTypes,
    ScrcpyControlMessageType.StartApp,
    ScrcpyControlMessageType.ResetVideo
  ])();

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/defaults.js
  var Defaults12 = /* @__PURE__ */ (() => ({
    ...omit(impl_exports13.Defaults, "lockVideoOrientation"),
    captureOrientation: void 0,
    angle: 0,
    screenOffTimeout: void 0,
    listApps: false,
    newDisplay: void 0,
    vdSystemDecorations: true
  }))();

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/init.js
  var LockOrientation = {
    Unlocked: 0,
    LockedInitial: 1,
    LockedValue: 2
  };
  var Orientation = {
    Orient0: 0,
    Orient90: 90,
    Orient180: 180,
    Orient270: 270
  };
  var CaptureOrientation = class _CaptureOrientation {
    static Unlocked = /* @__PURE__ */ (() => new _CaptureOrientation(LockOrientation.Unlocked, Orientation.Orient0, false))();
    lock;
    orientation;
    flip;
    constructor(lock, orientation, flip = false) {
      this.lock = lock;
      this.orientation = orientation;
      this.flip = flip;
    }
    toOptionValue() {
      if (this.lock === LockOrientation.Unlocked && this.orientation === Orientation.Orient0 && !this.flip) {
        return void 0;
      }
      if (this.lock === LockOrientation.LockedInitial) {
        return "@";
      }
      return (this.lock === LockOrientation.LockedValue ? "@" : "") + (this.flip ? "flip" : "") + this.orientation;
    }
  };
  var NewDisplay = class _NewDisplay {
    static Default = /* @__PURE__ */ new _NewDisplay();
    width;
    height;
    dpi;
    constructor(a, b, c) {
      if (a === void 0) {
        return;
      }
      if (b === void 0) {
        this.dpi = a;
        return;
      }
      this.width = a;
      this.height = b;
      this.dpi = c;
    }
    toOptionValue() {
      if (this.width === void 0 && this.height === void 0 && this.dpi === void 0) {
        return "";
      }
      if (this.width === void 0) {
        return `/${this.dpi}`;
      }
      if (this.dpi === void 0) {
        return `${this.width}x${this.height}`;
      }
      return `${this.width}x${this.height}/${this.dpi}`;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/3_0/impl/parse-encoder.js
  var EncoderRegex5 = /^\s+--(video|audio)-codec=(\S+)\s+--\1-encoder=(\S+)(?:\s*\((sw|hw|hybrid)\))?(?:\s*\[vendor\])?(?:\s*\(alias for (\S+)\))?$/;
  function toHardwareType(value) {
    switch (value) {
      case "sw":
        return "software";
      case "hw":
        return "hardware";
      case "hybrid":
        return "hybrid";
      default:
        throw new Error(`Unknown hardware type: ${value}`);
    }
  }
  function parseEncoder3(line) {
    const match = line.match(EncoderRegex5);
    return match ? {
      type: match[1],
      name: match[3],
      codec: match[2],
      hardwareType: match[4] ? toHardwareType(match[4]) : void 0,
      vendor: !!match[5],
      aliasFor: match[6]
    } : void 0;
  }

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/index.js
  var impl_exports15 = {};
  __export(impl_exports15, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults13,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/defaults.js
  var Defaults13 = /* @__PURE__ */ (() => ({
    ...impl_exports14.Defaults,
    vdDestroyContent: false
  }))();

  // node_modules/@yume-chan/scrcpy/esm/3_1/impl/serialize-uhid-create.js
  var UHidCreateControlMessage3 = struct({
    type: u8,
    id: u16,
    vendorId: u16,
    productId: u16,
    name: string(u8),
    data: buffer(u16)
  }, { littleEndian: false });
  function serializeUHidCreateControlMessage3(message) {
    return UHidCreateControlMessage3.serialize(message);
  }

  // node_modules/@yume-chan/scrcpy/esm/3_2/impl/index.js
  var impl_exports16 = {};
  __export(impl_exports16, {
    AckClipboardDeviceMessage: () => AckClipboardDeviceMessage,
    AckClipboardHandler: () => AckClipboardHandler,
    BackOrScreenOnControlMessage: () => BackOrScreenOnControlMessage2,
    CaptureOrientation: () => CaptureOrientation,
    ClipboardDeviceMessage: () => ClipboardDeviceMessage,
    ClipboardStream: () => ClipboardStream,
    CodecOptions: () => CodecOptions,
    ControlMessageTypes: () => ControlMessageTypes5,
    Crop: () => Crop,
    Defaults: () => Defaults14,
    EncoderRegex: () => EncoderRegex3,
    InjectScrollControlMessage: () => InjectScrollControlMessage3,
    InjectTouchControlMessage: () => InjectTouchControlMessage2,
    InstanceId: () => InstanceId,
    LockOrientation: () => LockOrientation,
    MediaStreamRawPacket: () => MediaStreamRawPacket,
    NewDisplay: () => NewDisplay,
    Orientation: () => Orientation,
    PointerId: () => PointerId,
    PtsConfig: () => PtsConfig,
    PtsKeyframe: () => PtsKeyframe,
    ScrollController: () => ScrollController3,
    SerializeOrder: () => SerializeOrder3,
    SetClipboardControlMessage: () => SetClipboardControlMessage2,
    SignedFloat: () => SignedFloat,
    UHidCreateControlMessage: () => UHidCreateControlMessage3,
    UHidOutputDeviceMessage: () => UHidOutputDeviceMessage,
    UHidOutputStream: () => UHidOutputStream,
    UnsignedFloat: () => UnsignedFloat,
    VideoOrientation: () => VideoOrientation2,
    createMediaStreamTransformer: () => createMediaStreamTransformer2,
    createScrollController: () => createScrollController3,
    parseAudioStreamMetadata: () => parseAudioStreamMetadata,
    parseDisplay: () => parseDisplay3,
    parseEncoder: () => parseEncoder3,
    parseVideoStreamMetadata: () => parseVideoStreamMetadata3,
    readString: () => readString,
    readU16: () => readU16,
    readU32: () => readU32,
    serialize: () => serialize2,
    serializeBackOrScreenOnControlMessage: () => serializeBackOrScreenOnControlMessage2,
    serializeInjectTouchControlMessage: () => serializeInjectTouchControlMessage2,
    serializeSetClipboardControlMessage: () => serializeSetClipboardControlMessage,
    serializeUHidCreateControlMessage: () => serializeUHidCreateControlMessage3,
    setListDisplays: () => setListDisplays2,
    setListEncoders: () => setListEncoders2
  });

  // node_modules/@yume-chan/scrcpy/esm/3_2/impl/defaults.js
  var Defaults14 = /* @__PURE__ */ (() => ({
    ...impl_exports15.Defaults,
    displayImePolicy: void 0
  }))();

  // node_modules/@yume-chan/scrcpy/esm/3_3_1/impl/scroll-controller.js
  var ScrollController4 = class {
    serializeScrollMessage(message) {
      message = {
        ...message,
        scrollX: message.scrollX / 16,
        scrollY: message.scrollY / 16
      };
      return impl_exports16.InjectScrollControlMessage.serialize(message);
    }
  };
  function createScrollController4() {
    return new ScrollController4();
  }

  // node_modules/@yume-chan/scrcpy/esm/3_3_1/options.js
  var ScrcpyOptions3_3_1 = class {
    static Defaults = Defaults14;
    value;
    get controlMessageTypes() {
      return ControlMessageTypes5;
    }
    #clipboard;
    get clipboard() {
      return this.#clipboard;
    }
    #ackClipboardHandler;
    #uHidOutput;
    get uHidOutput() {
      return this.#uHidOutput;
    }
    #deviceMessageParsers = new ScrcpyDeviceMessageParsers();
    get deviceMessageParsers() {
      return this.#deviceMessageParsers;
    }
    constructor(init) {
      this.value = { ...Defaults14, ...init };
      if (this.value.videoSource === "camera") {
        this.value.control = false;
      }
      if (this.value.audioDup) {
        this.value.audioSource = "playback";
      }
      if (this.value.control) {
        if (this.value.clipboardAutosync) {
          this.#clipboard = this.#deviceMessageParsers.add(new ClipboardStream());
          this.#ackClipboardHandler = this.#deviceMessageParsers.add(new AckClipboardHandler());
        }
        this.#uHidOutput = this.#deviceMessageParsers.add(new UHidOutputStream());
      }
    }
    serialize() {
      return serialize2(this.value, Defaults14);
    }
    setListDisplays() {
      setListDisplays2(this.value);
    }
    parseDisplay(line) {
      return parseDisplay3(line);
    }
    setListEncoders() {
      setListEncoders2(this.value);
    }
    parseEncoder(line) {
      return parseEncoder3(line);
    }
    parseVideoStreamMetadata(stream) {
      return parseVideoStreamMetadata3(this.value, stream);
    }
    parseAudioStreamMetadata(stream) {
      return parseAudioStreamMetadata(stream, this.value);
    }
    createMediaStreamTransformer() {
      return createMediaStreamTransformer2(this.value);
    }
    serializeInjectTouchControlMessage(message) {
      return serializeInjectTouchControlMessage2(message);
    }
    serializeBackOrScreenOnControlMessage(message) {
      return serializeBackOrScreenOnControlMessage2(message);
    }
    serializeSetClipboardControlMessage(message) {
      return this.#ackClipboardHandler.serializeSetClipboardControlMessage(message);
    }
    createScrollController() {
      return createScrollController4();
    }
    serializeUHidCreateControlMessage(message) {
      return serializeUHidCreateControlMessage3(message);
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/codec/av1.js
  var AndroidAv1Profile = {
    Main8: 1 << 0,
    Main10: 1 << 1,
    Main10Hdr10: 1 << 12,
    Main10Hdr10Plus: 1 << 13
  };
  var AndroidAv1Level = {
    Level2: 1 << 0,
    Level21: 1 << 1,
    Level22: 1 << 2,
    Level23: 1 << 3,
    Level3: 1 << 4,
    Level31: 1 << 5,
    Level32: 1 << 6,
    Level33: 1 << 7,
    Level4: 1 << 8,
    Level41: 1 << 9,
    Level42: 1 << 10,
    Level43: 1 << 11,
    Level5: 1 << 12,
    Level51: 1 << 13,
    Level52: 1 << 14,
    Level53: 1 << 15,
    Level6: 1 << 16,
    Level61: 1 << 17,
    Level62: 1 << 18,
    Level63: 1 << 19,
    Level7: 1 << 20,
    Level71: 1 << 21,
    Level72: 1 << 22,
    Level73: 1 << 23
  };
  var BitReader = class {
    #data;
    #byte;
    #bytePosition = 0;
    #bitPosition = 7;
    get byteAligned() {
      return this.#bitPosition === 7;
    }
    get ended() {
      return this.#bytePosition >= this.#data.length;
    }
    constructor(data) {
      this.#data = data;
      this.#byte = data[0];
    }
    f1() {
      const value = this.#byte >> this.#bitPosition;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
      }
      return value & 1;
    }
    f(n) {
      let value = 0;
      for (; n > 0; n -= 1) {
        value <<= 1;
        value |= this.f1();
      }
      return value;
    }
    skip(n) {
      if (n <= this.#bitPosition + 1) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#byte = this.#data[this.#bytePosition];
        return;
      }
      n -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      const bytes = n / 8 | 0;
      if (bytes > 0) {
        this.#bytePosition += bytes;
        n -= bytes * 8;
      }
      this.#bitPosition = 7 - n;
      this.#byte = this.#data[this.#bytePosition];
    }
    readBytes(n) {
      if (!this.byteAligned) {
        throw new Error("Bytes must be byte-aligned");
      }
      const value = this.#data.subarray(this.#bytePosition, this.#bytePosition + n);
      this.#bytePosition += n;
      this.#byte = this.#data[this.#bytePosition];
      return value;
    }
    getPosition() {
      return [this.#bytePosition, this.#bitPosition];
    }
    setPosition([bytePosition, bitPosition]) {
      this.#bytePosition = bytePosition;
      this.#bitPosition = bitPosition;
      this.#byte = this.#data[bytePosition];
    }
  };
  var ObuType = {
    SequenceHeader: 1,
    TemporalDelimiter: 2,
    FrameHeader: 3,
    TileGroup: 4,
    Metadata: 5,
    Frame: 6,
    RedundantFrameHeader: 7,
    TileList: 8,
    Padding: 15
  };
  var ColorPrimaries = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    GenericFilm: 8,
    Bt2020: 9,
    Xyz: 10,
    Smpte431: 11,
    Smpte432: 12,
    Ebu3213: 22
  };
  var TransferCharacteristics = {
    Bt709: 1,
    Unspecified: 2,
    Bt470M: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    Linear: 8,
    Log100: 9,
    Log100Sqrt10: 10,
    Iec61966: 11,
    Bt1361: 12,
    Srgb: 13,
    Bt2020Ten: 14,
    Bt2020Twelve: 15,
    Smpte2084: 16,
    Smpte428: 17,
    Hlg: 18
  };
  var MatrixCoefficients = {
    Identity: 0,
    Bt709: 1,
    Unspecified: 2,
    Fcc: 4,
    Bt470BG: 5,
    Bt601: 6,
    Smpte240: 7,
    YCgCo: 8,
    Bt2020Ncl: 9,
    Bt2020Cl: 10,
    Smpte2085: 11,
    ChromatNcl: 12,
    ChromatCl: 13,
    ICtCp: 14
  };
  var Av1 = class _Av1 extends BitReader {
    static ObuType = ObuType;
    static ColorPrimaries = ColorPrimaries;
    static TransferCharacteristics = TransferCharacteristics;
    static MatrixCoefficients = MatrixCoefficients;
    #Leb128Bytes = 0;
    uvlc() {
      let leadingZeros = 0;
      while (!this.f1()) {
        leadingZeros += 1;
      }
      if (leadingZeros >= 32) {
        return 2 ** 32 - 1;
      }
      const value = this.f(leadingZeros);
      return value + (1 << leadingZeros >>> 0) - 1;
    }
    leb128() {
      if (!this.byteAligned) {
        throw new Error("LEB128 must be byte-aligned");
      }
      let value = 0n;
      this.#Leb128Bytes = 0;
      for (let i = 0n; i < 8n; i += 1n) {
        const leb128_byte = this.f(8);
        value |= BigInt(leb128_byte & 127) << 7n * i;
        this.#Leb128Bytes += 1;
        if ((leb128_byte & 128) == 0) {
          break;
        }
      }
      return value;
    }
    *annexBBitstream() {
      while (!this.ended) {
        const temporal_unit_size = this.leb128();
        yield* this.temporalUnit(temporal_unit_size);
      }
    }
    *temporalUnit(sz) {
      while (sz > 0) {
        const frame_unit_size = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        yield* this.frameUnit(frame_unit_size);
        sz -= frame_unit_size;
      }
    }
    *frameUnit(sz) {
      while (sz > 0) {
        const obu_length = this.leb128();
        sz -= BigInt(this.#Leb128Bytes);
        const obu = this.openBitstreamUnit(obu_length);
        if (obu) {
          yield obu;
        }
        sz -= obu_length;
      }
    }
    #OperatingPointIdc = 0;
    openBitstreamUnit(sz) {
      const obu_header = this.obuHeader();
      let obu_size;
      if (obu_header.obu_has_size_field) {
        obu_size = this.leb128();
      } else if (sz !== void 0) {
        obu_size = sz - 1n - (obu_header.obu_extension_flag ? 1n : 0n);
      } else {
        throw new Error("obu_has_size_field must be true");
      }
      const startPosition = this.getPosition();
      if (obu_header.obu_type !== _Av1.ObuType.SequenceHeader && obu_header.obu_type !== _Av1.ObuType.TemporalDelimiter && this.#OperatingPointIdc !== 0 && obu_header.obu_extension_header) {
        const inTemporalLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.temporal_id);
        const inSpatialLayer = !!(this.#OperatingPointIdc & 1 << obu_header.obu_extension_header.spatial_id + 8);
        if (!inTemporalLayer || !inSpatialLayer) {
          this.skip(Number(obu_size));
          return;
        }
      }
      let sequence_header_obu;
      switch (obu_header.obu_type) {
        case _Av1.ObuType.SequenceHeader:
          sequence_header_obu = this.sequenceHeaderObu();
          break;
      }
      const currentPosition = this.getPosition();
      const payloadBits = (currentPosition[0] - startPosition[0]) * 8 + (startPosition[1] - currentPosition[1]);
      if (obu_size > 0) {
        this.skip(Number(obu_size) * 8 - payloadBits);
      }
      return {
        obu_header,
        obu_size,
        sequence_header_obu
      };
    }
    obuHeader() {
      const obu_forbidden_bit = !!this.f1();
      if (obu_forbidden_bit) {
        throw new Error("Invalid data");
      }
      const obu_type = this.f(4);
      const obu_extension_flag = !!this.f1();
      const obu_has_size_field = !!this.f1();
      this.f1();
      let obu_extension_header;
      if (obu_extension_flag) {
        obu_extension_header = this.obuExtensionHeader();
      }
      return {
        obu_type,
        obu_extension_flag,
        obu_has_size_field,
        obu_extension_header
      };
    }
    obuExtensionHeader() {
      const temporal_id = this.f(3);
      const spatial_id = this.f(2);
      this.skip(3);
      return { temporal_id, spatial_id };
    }
    static SelectScreenContentTools = 2;
    static SelectIntegerMv = 2;
    sequenceHeaderObu() {
      const seq_profile = this.f(3);
      const still_picture = !!this.f1();
      const reduced_still_picture_header = !!this.f1();
      let timing_info_present_flag = false;
      let timing_info;
      let decoder_model_info_present_flag = false;
      let decoder_model_info;
      let initial_display_delay_present_flag = false;
      let operating_points_cnt_minus_1 = 0;
      const operating_point_idc = [];
      const seq_level_idx = [];
      const seq_tier = [];
      const decoder_model_present_for_this_op = [];
      const initial_display_delay_present_for_this_op = [];
      let operating_parameters_info;
      let initial_display_delay_minus_1;
      if (reduced_still_picture_header) {
        operating_point_idc[0] = 0;
        seq_level_idx[0] = this.f(5);
        seq_tier[0] = 0;
        decoder_model_present_for_this_op[0] = false;
        initial_display_delay_present_for_this_op[0] = false;
      } else {
        timing_info_present_flag = !!this.f1();
        if (timing_info_present_flag) {
          timing_info = this.timingInfo();
          decoder_model_info_present_flag = !!this.f1();
          if (decoder_model_info_present_flag) {
            decoder_model_info = this.decoderModelInfo();
            operating_parameters_info = [];
          }
        }
        initial_display_delay_present_flag = !!this.f1();
        if (initial_display_delay_present_flag) {
          initial_display_delay_minus_1 = [];
        }
        operating_points_cnt_minus_1 = this.f(5);
        for (let i = 0; i <= operating_points_cnt_minus_1; i += 1) {
          operating_point_idc[i] = this.f(12);
          seq_level_idx[i] = this.f(5);
          if (seq_level_idx[i] > 7) {
            seq_tier[i] = this.f1();
          } else {
            seq_tier[i] = 0;
          }
          if (decoder_model_info_present_flag) {
            decoder_model_present_for_this_op[i] = !!this.f1();
            if (decoder_model_present_for_this_op[i]) {
              operating_parameters_info[i] = this.operatingParametersInfo(decoder_model_info);
            }
          } else {
            decoder_model_present_for_this_op[i] = false;
          }
          if (initial_display_delay_present_flag) {
            initial_display_delay_present_for_this_op[i] = !!this.f1();
            if (initial_display_delay_present_for_this_op[i]) {
              initial_display_delay_minus_1[i] = this.f(4);
            }
          }
        }
      }
      const operatingPoint = this.chooseOperatingPoint();
      this.#OperatingPointIdc = operating_point_idc[operatingPoint];
      const frame_width_bits_minus_1 = this.f(4);
      const frame_height_bits_minus_1 = this.f(4);
      const max_frame_width_minus_1 = this.f(frame_width_bits_minus_1 + 1);
      const max_frame_height_minus_1 = this.f(frame_height_bits_minus_1 + 1);
      let frame_id_numbers_present_flag = false;
      let delta_frame_id_length_minus_2;
      let additional_frame_id_length_minus_1;
      if (!reduced_still_picture_header) {
        frame_id_numbers_present_flag = !!this.f1();
        if (frame_id_numbers_present_flag) {
          delta_frame_id_length_minus_2 = this.f(4);
          additional_frame_id_length_minus_1 = this.f(3);
        }
      }
      const use_128x128_superblock = !!this.f1();
      const enable_filter_intra = !!this.f1();
      const enable_intra_edge_filter = !!this.f1();
      let enable_interintra_compound = false;
      let enable_masked_compound = false;
      let enable_warped_motion = false;
      let enable_dual_filter = false;
      let enable_order_hint = false;
      let enable_jnt_comp = false;
      let enable_ref_frame_mvs = false;
      let seq_choose_screen_content_tools = false;
      let seq_force_screen_content_tools = _Av1.SelectScreenContentTools;
      let seq_choose_integer_mv = false;
      let seq_force_integer_mv = _Av1.SelectIntegerMv;
      let order_hint_bits_minus_1;
      if (!reduced_still_picture_header) {
        enable_interintra_compound = !!this.f1();
        enable_masked_compound = !!this.f1();
        enable_warped_motion = !!this.f1();
        enable_dual_filter = !!this.f1();
        enable_order_hint = !!this.f1();
        if (enable_order_hint) {
          enable_jnt_comp = !!this.f1();
          enable_ref_frame_mvs = !!this.f1();
        }
        seq_choose_screen_content_tools = !!this.f1();
        if (!seq_choose_screen_content_tools) {
          seq_force_screen_content_tools = this.f1();
        }
        if (seq_force_screen_content_tools > 0) {
          seq_choose_integer_mv = !!this.f1();
          if (!seq_choose_integer_mv) {
            seq_force_integer_mv = this.f1();
          }
        }
        if (enable_order_hint) {
          order_hint_bits_minus_1 = this.f(3);
        }
      }
      const enable_superres = !!this.f1();
      const enable_cdef = !!this.f1();
      const enable_restoration = !!this.f1();
      const color_config = this.colorConfig(seq_profile);
      const film_grain_params_present = !!this.f1();
      return {
        seq_profile,
        still_picture,
        reduced_still_picture_header,
        timing_info_present_flag,
        timing_info,
        decoder_model_info_present_flag,
        decoder_model_info,
        initial_display_delay_present_flag,
        initial_display_delay_minus_1,
        operating_points_cnt_minus_1,
        operating_point_idc,
        seq_level_idx,
        seq_tier,
        decoder_model_present_for_this_op,
        operating_parameters_info,
        initial_display_delay_present_for_this_op,
        frame_width_bits_minus_1,
        frame_height_bits_minus_1,
        max_frame_width_minus_1,
        max_frame_height_minus_1,
        frame_id_numbers_present_flag,
        delta_frame_id_length_minus_2,
        additional_frame_id_length_minus_1,
        use_128x128_superblock,
        enable_filter_intra,
        enable_intra_edge_filter,
        enable_interintra_compound,
        enable_masked_compound,
        enable_warped_motion,
        enable_dual_filter,
        enable_order_hint,
        enable_jnt_comp,
        enable_ref_frame_mvs,
        seq_choose_screen_content_tools,
        seq_force_screen_content_tools,
        seq_choose_integer_mv,
        seq_force_integer_mv,
        order_hint_bits_minus_1,
        enable_superres,
        enable_cdef,
        enable_restoration,
        color_config,
        film_grain_params_present
      };
    }
    searchSequenceHeaderObu() {
      while (!this.ended) {
        const obu = this.openBitstreamUnit();
        if (!obu) {
          continue;
        }
        if (obu.sequence_header_obu) {
          return obu.sequence_header_obu;
        }
      }
      return void 0;
    }
    timingInfo() {
      const num_units_in_display_tick = this.f(32);
      const time_scale = this.f(32);
      const equal_picture_interval = !!this.f1();
      let num_ticks_per_picture_minus_1;
      if (equal_picture_interval) {
        num_ticks_per_picture_minus_1 = this.uvlc();
      }
      return {
        num_units_in_display_tick,
        time_scale,
        equal_picture_interval,
        num_ticks_per_picture_minus_1
      };
    }
    decoderModelInfo() {
      const buffer_delay_length_minus_1 = this.f(5);
      const num_units_in_decoding_tick = this.f(32);
      const buffer_removal_time_length_minus_1 = this.f(5);
      const frame_presentation_time_length_minus_1 = this.f(5);
      return {
        buffer_delay_length_minus_1,
        num_units_in_decoding_tick,
        buffer_removal_time_length_minus_1,
        frame_presentation_time_length_minus_1
      };
    }
    operatingParametersInfo(decoderModelInfo) {
      const n = decoderModelInfo.buffer_delay_length_minus_1 + 1;
      const decoder_buffer_delay = this.f(n);
      const encoder_buffer_delay = this.f(n);
      const low_delay_mode_flag = !!this.f1();
      return {
        decoder_buffer_delay,
        encoder_buffer_delay,
        low_delay_mode_flag
      };
    }
    chooseOperatingPoint() {
      return 0;
    }
    colorConfig(seq_profile) {
      const high_bitdepth = !!this.f1();
      let twelve_bit = false;
      let BitDepth = 8;
      if (seq_profile === 2 && high_bitdepth) {
        twelve_bit = !!this.f1();
        BitDepth = twelve_bit ? 12 : 10;
      } else if (seq_profile <= 2) {
        BitDepth = high_bitdepth ? 10 : 8;
      }
      let mono_chrome = false;
      if (seq_profile === 1) {
        mono_chrome = !!this.f1();
      }
      const color_description_present_flag = !!this.f1();
      let color_primaries = _Av1.ColorPrimaries.Unspecified;
      let transfer_characteristics = _Av1.TransferCharacteristics.Unspecified;
      let matrix_coefficients = _Av1.MatrixCoefficients.Unspecified;
      if (color_description_present_flag) {
        color_primaries = this.f(8);
        transfer_characteristics = this.f(8);
        matrix_coefficients = this.f(8);
      }
      let color_range = false;
      let subsampling_x;
      let subsampling_y;
      let chroma_sample_position = 0;
      let separate_uv_delta_q = false;
      if (mono_chrome) {
        color_range = !!this.f1();
        subsampling_x = true;
        subsampling_y = true;
      } else {
        if (color_primaries === _Av1.ColorPrimaries.Bt709 && transfer_characteristics === _Av1.TransferCharacteristics.Srgb && matrix_coefficients === _Av1.MatrixCoefficients.Identity) {
          color_range = true;
          subsampling_x = false;
          subsampling_y = false;
        } else {
          color_range = !!this.f1();
          switch (seq_profile) {
            case 0:
              subsampling_x = true;
              subsampling_y = true;
              break;
            case 1:
              subsampling_x = false;
              subsampling_y = false;
              break;
            default:
              if (BitDepth == 12) {
                subsampling_x = !!this.f1();
                if (subsampling_x) {
                  subsampling_y = !!this.f1();
                } else {
                  subsampling_y = false;
                }
              } else {
                subsampling_x = true;
                subsampling_y = false;
              }
              break;
          }
          if (subsampling_x && subsampling_y) {
            chroma_sample_position = this.f(2);
          }
        }
        separate_uv_delta_q = !!this.f1();
      }
      return {
        high_bitdepth,
        twelve_bit,
        BitDepth,
        mono_chrome,
        color_description_present_flag,
        color_primaries,
        transfer_characteristics,
        matrix_coefficients,
        color_range,
        subsampling_x,
        subsampling_y,
        chroma_sample_position,
        separate_uv_delta_q
      };
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/codec/nalu.js
  function* annexBSplitNalu(buffer2) {
    let start = -1;
    let zeroCount = 0;
    let inEmulation = false;
    for (let i = 0; i < buffer2.length; i += 1) {
      const byte = buffer2[i];
      if (inEmulation) {
        if (byte > 3) {
          throw new Error("Invalid data");
        }
        inEmulation = false;
        continue;
      }
      if (byte === 0) {
        zeroCount += 1;
        continue;
      }
      const prevZeroCount = zeroCount;
      zeroCount = 0;
      if (start === -1) {
        if (prevZeroCount >= 2 && byte === 1) {
          start = i + 1;
          continue;
        }
        throw new Error("Invalid data");
      }
      if (prevZeroCount < 2) {
        continue;
      }
      if (byte === 1) {
        yield buffer2.subarray(start, i - prevZeroCount);
        start = i + 1;
        continue;
      }
      if (prevZeroCount > 2) {
        throw new Error("Invalid data");
      }
      switch (byte) {
        case 2:
          throw new Error("Invalid data");
        case 3:
          inEmulation = true;
          break;
        default:
          break;
      }
    }
    if (inEmulation) {
      throw new Error("Invalid data");
    }
    yield buffer2.subarray(start, buffer2.length);
  }
  var NaluSodbBitReader = class {
    #nalu;
    // logical length is `#byteLength * 8 + (7 - #stopBitIndex)`
    #byteLength;
    #stopBitIndex;
    #zeroCount = 0;
    // logical position is `#bytePosition * 8 + (7 - #bitPosition)`
    #bytePosition = 0;
    #bitPosition = 7;
    #byte = 0;
    get byteLength() {
      return this.#byteLength;
    }
    get stopBitIndex() {
      return this.#stopBitIndex;
    }
    get bytePosition() {
      return this.#bytePosition;
    }
    get bitPosition() {
      return this.#bitPosition;
    }
    get ended() {
      return this.#bytePosition >= this.#byteLength && this.#bitPosition <= this.#stopBitIndex;
    }
    constructor(nalu) {
      this.#nalu = nalu;
      for (let i = nalu.length - 1; i >= 0; i -= 1) {
        if (this.#nalu[i] === 0) {
          continue;
        }
        const byte = nalu[i];
        for (let j = 0; j < 8; j += 1) {
          if ((byte >> j & 1) === 1) {
            this.#byteLength = i;
            this.#stopBitIndex = j;
            this.#loadByte();
            return;
          }
        }
      }
      throw new Error("Stop bit not found");
    }
    #loadByte() {
      this.#byte = this.#nalu[this.#bytePosition];
      if (this.#zeroCount === 2 && this.#byte === 3) {
        this.#zeroCount = 0;
        this.#bytePosition += 1;
        this.#loadByte();
        return;
      }
      if (this.#byte === 0) {
        this.#zeroCount += 1;
      } else {
        this.#zeroCount = 0;
      }
    }
    next() {
      if (this.ended) {
        throw new Error("Bit index out of bounds");
      }
      const value = this.#byte >> this.#bitPosition & 1;
      this.#bitPosition -= 1;
      if (this.#bitPosition < 0) {
        this.#bytePosition += 1;
        this.#bitPosition = 7;
        this.#loadByte();
      }
      return value;
    }
    read(length) {
      if (length > 32) {
        throw new Error("Read length too large");
      }
      let result = 0;
      for (let i = 0; i < length; i += 1) {
        result = result << 1 | this.next();
      }
      return result;
    }
    /**
     * Throws an error if the current position is invalid for `skip`.
     *
     * Usually it will throw if `ended` is `true`,
     * except when the bit position is at the stop bit,
     * in which case `ended` will be `true`, but it won't throw.
     * `skip` can skip all remaining bits, and stop at the end position.
     * The next `next` call will throw since there is no more bits to read.
     */
    #checkSkipPosition() {
      if (this.#bytePosition >= this.#byteLength && this.#bitPosition < this.#stopBitIndex) {
        throw new Error("Bit index out of bounds");
      }
    }
    skip(length) {
      if (length <= this.#bitPosition + 1) {
        this.#bitPosition -= length;
        this.#checkSkipPosition();
        return;
      }
      length -= this.#bitPosition + 1;
      this.#bytePosition += 1;
      this.#bitPosition = 7;
      this.#loadByte();
      this.#checkSkipPosition();
      for (; length >= 8; length -= 8) {
        this.#bytePosition += 1;
        this.#loadByte();
        this.#checkSkipPosition();
      }
      this.#bitPosition = 7 - length;
      this.#checkSkipPosition();
    }
    decodeExponentialGolombNumber() {
      let length = 0;
      while (this.next() === 0) {
        length += 1;
      }
      if (length === 0) {
        return 0;
      }
      return (1 << length | this.read(length)) - 1;
    }
    #save() {
      return {
        zeroCount: this.#zeroCount,
        bytePosition: this.#bytePosition,
        bitPosition: this.#bitPosition,
        byte: this.#byte
      };
    }
    #restore(state) {
      this.#zeroCount = state.zeroCount;
      this.#bytePosition = state.bytePosition;
      this.#bitPosition = state.bitPosition;
      this.#byte = state.byte;
    }
    peek(length) {
      const state = this.#save();
      const result = this.read(length);
      this.#restore(state);
      return result;
    }
    readBytes(length) {
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        result[i] = this.read(8);
      }
      return result;
    }
    peekBytes(length) {
      const state = this.#save();
      const result = this.readBytes(length);
      this.#restore(state);
      return result;
    }
  };

  // node_modules/@yume-chan/scrcpy/esm/codec/h264.js
  var AndroidAvcProfile = {
    Baseline: 1 << 0,
    Main: 1 << 1,
    Extended: 1 << 2,
    High: 1 << 3,
    High10: 1 << 4,
    High422: 1 << 5,
    High444: 1 << 6,
    ConstrainedBaseline: 1 << 16,
    ConstrainedHigh: 1 << 19
  };
  var AndroidAvcLevel = {
    Level1: 1 << 0,
    Level1b: 1 << 1,
    Level11: 1 << 2,
    Level12: 1 << 3,
    Level13: 1 << 4,
    Level2: 1 << 5,
    Level21: 1 << 6,
    Level22: 1 << 7,
    Level3: 1 << 8,
    Level31: 1 << 9,
    Level32: 1 << 10,
    Level4: 1 << 11,
    Level41: 1 << 12,
    Level42: 1 << 13,
    Level5: 1 << 14,
    Level51: 1 << 15,
    Level52: 1 << 16,
    Level6: 1 << 17,
    Level61: 1 << 18,
    Level62: 1 << 19
  };
  function h264ParseSequenceParameterSet(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid data");
    }
    const nal_ref_idc = reader.read(2);
    const nal_unit_type = reader.read(5);
    if (nal_unit_type !== 7) {
      throw new Error("Invalid data");
    }
    if (nal_ref_idc === 0) {
      throw new Error("Invalid data");
    }
    const profile_idc = reader.read(8);
    const constraint_set = reader.peek(8);
    const constraint_set0_flag = !!reader.next();
    const constraint_set1_flag = !!reader.next();
    const constraint_set2_flag = !!reader.next();
    const constraint_set3_flag = !!reader.next();
    const constraint_set4_flag = !!reader.next();
    const constraint_set5_flag = !!reader.next();
    if (reader.read(2) !== 0) {
      throw new Error("Invalid data");
    }
    const level_idc = reader.read(8);
    const seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244 || profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118 || profile_idc === 128 || profile_idc === 138 || profile_idc === 139 || profile_idc === 134) {
      const chroma_format_idc = reader.decodeExponentialGolombNumber();
      if (chroma_format_idc === 3) {
        reader.next();
      }
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      reader.next();
      const seq_scaling_matrix_present_flag = !!reader.next();
      if (seq_scaling_matrix_present_flag) {
        const seq_scaling_list_present_flag = [];
        for (let i = 0; i < (chroma_format_idc !== 3 ? 8 : 12); i += 1) {
          seq_scaling_list_present_flag[i] = !!reader.next();
          if (seq_scaling_list_present_flag[i])
            if (i < 6) {
            } else {
            }
        }
      }
    }
    reader.decodeExponentialGolombNumber();
    const pic_order_cnt_type = reader.decodeExponentialGolombNumber();
    if (pic_order_cnt_type === 0) {
      reader.decodeExponentialGolombNumber();
    } else if (pic_order_cnt_type === 1) {
      reader.next();
      reader.decodeExponentialGolombNumber();
      reader.decodeExponentialGolombNumber();
      const num_ref_frames_in_pic_order_cnt_cycle = reader.decodeExponentialGolombNumber();
      const offset_for_ref_frame = [];
      for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i += 1) {
        offset_for_ref_frame[i] = reader.decodeExponentialGolombNumber();
      }
    }
    reader.decodeExponentialGolombNumber();
    reader.next();
    const pic_width_in_mbs_minus1 = reader.decodeExponentialGolombNumber();
    const pic_height_in_map_units_minus1 = reader.decodeExponentialGolombNumber();
    const frame_mbs_only_flag = reader.next();
    if (!frame_mbs_only_flag) {
      reader.next();
    }
    reader.next();
    const frame_cropping_flag = !!reader.next();
    let frame_crop_left_offset;
    let frame_crop_right_offset;
    let frame_crop_top_offset;
    let frame_crop_bottom_offset;
    if (frame_cropping_flag) {
      frame_crop_left_offset = reader.decodeExponentialGolombNumber();
      frame_crop_right_offset = reader.decodeExponentialGolombNumber();
      frame_crop_top_offset = reader.decodeExponentialGolombNumber();
      frame_crop_bottom_offset = reader.decodeExponentialGolombNumber();
    } else {
      frame_crop_left_offset = 0;
      frame_crop_right_offset = 0;
      frame_crop_top_offset = 0;
      frame_crop_bottom_offset = 0;
    }
    const vui_parameters_present_flag = !!reader.next();
    if (vui_parameters_present_flag) {
    }
    return {
      profile_idc,
      constraint_set,
      constraint_set0_flag,
      constraint_set1_flag,
      constraint_set2_flag,
      constraint_set3_flag,
      constraint_set4_flag,
      constraint_set5_flag,
      level_idc,
      seq_parameter_set_id,
      pic_width_in_mbs_minus1,
      pic_height_in_map_units_minus1,
      frame_mbs_only_flag,
      frame_cropping_flag,
      frame_crop_left_offset,
      frame_crop_right_offset,
      frame_crop_top_offset,
      frame_crop_bottom_offset
    };
  }
  function h264SearchConfiguration(buffer2) {
    let sequenceParameterSet;
    let pictureParameterSet;
    for (const nalu of annexBSplitNalu(buffer2)) {
      const naluType = nalu[0] & 31;
      switch (naluType) {
        case 7:
          sequenceParameterSet = nalu;
          if (pictureParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        case 8:
          pictureParameterSet = nalu;
          if (sequenceParameterSet) {
            return {
              sequenceParameterSet,
              pictureParameterSet
            };
          }
          break;
        default:
          break;
      }
    }
    throw new Error("Invalid data");
  }
  function h264ParseConfiguration(data) {
    const { sequenceParameterSet, pictureParameterSet } = h264SearchConfiguration(data);
    const { profile_idc: profileIndex, constraint_set: constraintSet, level_idc: levelIndex, pic_width_in_mbs_minus1, pic_height_in_map_units_minus1, frame_mbs_only_flag, frame_crop_left_offset, frame_crop_right_offset, frame_crop_top_offset, frame_crop_bottom_offset } = h264ParseSequenceParameterSet(sequenceParameterSet);
    const encodedWidth = (pic_width_in_mbs_minus1 + 1) * 16;
    const encodedHeight = (pic_height_in_map_units_minus1 + 1) * (2 - frame_mbs_only_flag) * 16;
    const cropLeft = frame_crop_left_offset * 2;
    const cropRight = frame_crop_right_offset * 2;
    const cropTop = frame_crop_top_offset * 2;
    const cropBottom = frame_crop_bottom_offset * 2;
    const croppedWidth = encodedWidth - cropLeft - cropRight;
    const croppedHeight = encodedHeight - cropTop - cropBottom;
    return {
      pictureParameterSet,
      sequenceParameterSet,
      profileIndex,
      constraintSet,
      levelIndex,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }

  // node_modules/@yume-chan/scrcpy/esm/codec/h265.js
  var AndroidHevcProfile = {
    Main: 1 << 0,
    Main10: 1 << 1,
    MainStill: 1 << 2,
    Main10Hdr10: 1 << 12,
    Main10Hdr10Plus: 1 << 13
  };
  var AndroidHevcLevel = {
    MainTierLevel1: 1 << 0,
    HighTierLevel1: 1 << 1,
    MainTierLevel2: 1 << 2,
    HighTierLevel2: 1 << 3,
    MainTierLevel21: 1 << 4,
    HighTierLevel21: 1 << 5,
    MainTierLevel3: 1 << 6,
    HighTierLevel3: 1 << 7,
    MainTierLevel31: 1 << 8,
    HighTierLevel31: 1 << 9,
    MainTierLevel4: 1 << 10,
    HighTierLevel4: 1 << 11,
    MainTierLevel41: 1 << 12,
    HighTierLevel41: 1 << 13,
    MainTierLevel5: 1 << 14,
    HighTierLevel5: 1 << 15,
    MainTierLevel51: 1 << 16,
    HighTierLevel51: 1 << 17,
    MainTierLevel52: 1 << 18,
    HighTierLevel52: 1 << 19,
    MainTierLevel6: 1 << 20,
    HighTierLevel6: 1 << 21,
    MainTierLevel61: 1 << 22,
    HighTierLevel61: 1 << 23,
    MainTierLevel62: 1 << 24,
    HighTierLevel62: 1 << 25
  };
  function getSubWidthC(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 3:
        return 1;
      case 1:
      case 2:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function getSubHeightC(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
      case 2:
      case 3:
        return 1;
      case 1:
        return 2;
      default:
        throw new Error("Invalid chroma_format_idc");
    }
  }
  function h265ParseNaluHeader(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    if (reader.next() !== 0) {
      throw new Error("Invalid NALU header");
    }
    const nal_unit_type = reader.read(6);
    const nuh_layer_id = reader.read(6);
    const nuh_temporal_id_plus1 = reader.read(3);
    return {
      nal_unit_type,
      nuh_layer_id,
      nuh_temporal_id_plus1
    };
  }
  function h265ParseVideoParameterSet(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    const vps_video_parameter_set_id = reader.read(4);
    const vps_base_layer_internal_flag = !!reader.next();
    const vps_base_layer_available_flag = !!reader.next();
    const vps_max_layers_minus1 = reader.read(6);
    const vps_max_sub_layers_minus1 = reader.read(3);
    const vps_temporal_id_nesting_flag = !!reader.next();
    reader.skip(16);
    const profileTierLevel = h265ParseProfileTierLevel(reader, true, vps_max_sub_layers_minus1);
    const vps_sub_layer_ordering_info_present_flag = !!reader.next();
    const vps_max_dec_pic_buffering_minus1 = [];
    const vps_max_num_reorder_pics = [];
    const vps_max_latency_increase_plus1 = [];
    for (let i = vps_sub_layer_ordering_info_present_flag ? 0 : vps_max_sub_layers_minus1; i <= vps_max_sub_layers_minus1; i += 1) {
      vps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      vps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      vps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const vps_max_layer_id = reader.read(6);
    const vps_num_layer_sets_minus1 = reader.decodeExponentialGolombNumber();
    const layer_id_included_flag = [];
    for (let i = 1; i <= vps_num_layer_sets_minus1; i += 1) {
      layer_id_included_flag[i] = [];
      for (let j = 0; j <= vps_max_layer_id; j += 1) {
        layer_id_included_flag[i][j] = !!reader.next();
      }
    }
    const vps_timing_info_present_flag = !!reader.next();
    let vps_num_units_in_tick;
    let vps_time_scale;
    let vps_poc_proportional_to_timing_flag;
    let vps_num_ticks_poc_diff_one_minus1;
    let vps_num_hrd_parameters;
    let hrd_layer_set_idx;
    let cprms_present_flag;
    let hrdParameters;
    if (vps_timing_info_present_flag) {
      vps_num_units_in_tick = reader.read(32);
      vps_time_scale = reader.read(32);
      vps_poc_proportional_to_timing_flag = !!reader.next();
      if (vps_poc_proportional_to_timing_flag) {
        vps_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vps_num_hrd_parameters = reader.decodeExponentialGolombNumber();
      hrd_layer_set_idx = [];
      cprms_present_flag = [true];
      hrdParameters = [];
      for (let i = 0; i < vps_num_hrd_parameters; i += 1) {
        hrd_layer_set_idx[i] = reader.decodeExponentialGolombNumber();
        if (i > 0) {
          cprms_present_flag[i] = !!reader.next();
        }
        hrdParameters[i] = h265ParseHrdParameters(reader, cprms_present_flag[i], vps_max_sub_layers_minus1);
      }
    }
    const vps_extension_flag = !!reader.next();
    return {
      vps_video_parameter_set_id,
      vps_base_layer_internal_flag,
      vps_base_layer_available_flag,
      vps_max_layers_minus1,
      vps_max_sub_layers_minus1,
      vps_temporal_id_nesting_flag,
      profileTierLevel,
      vps_sub_layer_ordering_info_present_flag,
      vps_max_dec_pic_buffering_minus1,
      vps_max_num_reorder_pics,
      vps_max_latency_increase_plus1,
      vps_max_layer_id,
      vps_num_layer_sets_minus1,
      layer_id_included_flag,
      vps_timing_info_present_flag,
      vps_num_units_in_tick,
      vps_time_scale,
      vps_poc_proportional_to_timing_flag,
      vps_num_ticks_poc_diff_one_minus1,
      vps_num_hrd_parameters,
      hrd_layer_set_idx,
      cprms_present_flag,
      hrdParameters,
      vps_extension_flag
    };
  }
  function h265ParseSequenceParameterSet(nalu) {
    const reader = new NaluSodbBitReader(nalu);
    const sps_video_parameter_set_id = reader.read(4);
    const sps_max_sub_layers_minus1 = reader.read(3);
    const sps_temporal_id_nesting_flag = !!reader.next();
    const profileTierLevel = h265ParseProfileTierLevel(reader, true, sps_max_sub_layers_minus1);
    const sps_seq_parameter_set_id = reader.decodeExponentialGolombNumber();
    const chroma_format_idc = reader.decodeExponentialGolombNumber();
    let separate_colour_plane_flag;
    if (chroma_format_idc === 3) {
      separate_colour_plane_flag = !!reader.next();
    }
    const pic_width_in_luma_samples = reader.decodeExponentialGolombNumber();
    const pic_height_in_luma_samples = reader.decodeExponentialGolombNumber();
    const conformance_window_flag = !!reader.next();
    let conf_win_left_offset;
    let conf_win_right_offset;
    let conf_win_top_offset;
    let conf_win_bottom_offset;
    if (conformance_window_flag) {
      conf_win_left_offset = reader.decodeExponentialGolombNumber();
      conf_win_right_offset = reader.decodeExponentialGolombNumber();
      conf_win_top_offset = reader.decodeExponentialGolombNumber();
      conf_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const bit_depth_luma_minus8 = reader.decodeExponentialGolombNumber();
    const bit_depth_chroma_minus8 = reader.decodeExponentialGolombNumber();
    const log2_max_pic_order_cnt_lsb_minus4 = reader.decodeExponentialGolombNumber();
    const sps_max_dec_pic_buffering_minus1 = [];
    const sps_max_num_reorder_pics = [];
    const sps_max_latency_increase_plus1 = [];
    const sps_sub_layer_ordering_info_present_flag = !!reader.next();
    for (let i = sps_sub_layer_ordering_info_present_flag ? 0 : sps_max_sub_layers_minus1; i <= sps_max_sub_layers_minus1; i += 1) {
      sps_max_dec_pic_buffering_minus1[i] = reader.decodeExponentialGolombNumber();
      sps_max_num_reorder_pics[i] = reader.decodeExponentialGolombNumber();
      sps_max_latency_increase_plus1[i] = reader.decodeExponentialGolombNumber();
    }
    const log2_min_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_coding_block_size = reader.decodeExponentialGolombNumber();
    const log2_min_luma_transform_block_size_minus2 = reader.decodeExponentialGolombNumber();
    const log2_diff_max_min_luma_transform_block_size = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_inter = reader.decodeExponentialGolombNumber();
    const max_transform_hierarchy_depth_intra = reader.decodeExponentialGolombNumber();
    const scaling_list_enabled_flag = !!reader.next();
    let sps_scaling_list_data_present_flag;
    let scalingListData;
    if (scaling_list_enabled_flag) {
      sps_scaling_list_data_present_flag = !!reader.next();
      if (sps_scaling_list_data_present_flag) {
        scalingListData = h265ParseScalingListData(reader);
      }
    }
    const amp_enabled_flag = !!reader.next();
    const sample_adaptive_offset_enabled_flag = !!reader.next();
    const pcm_enabled_flag = !!reader.next();
    let pcm_sample_bit_depth_luma_minus1;
    let pcm_sample_bit_depth_chroma_minus1;
    let log2_min_pcm_luma_coding_block_size_minus3;
    let log2_diff_max_min_pcm_luma_coding_block_size;
    let pcm_loop_filter_disabled_flag;
    if (pcm_enabled_flag) {
      pcm_sample_bit_depth_luma_minus1 = reader.read(4);
      pcm_sample_bit_depth_chroma_minus1 = reader.read(4);
      log2_min_pcm_luma_coding_block_size_minus3 = reader.decodeExponentialGolombNumber();
      log2_diff_max_min_pcm_luma_coding_block_size = reader.decodeExponentialGolombNumber();
      pcm_loop_filter_disabled_flag = !!reader.next();
    }
    const num_short_term_ref_pic_sets = reader.decodeExponentialGolombNumber();
    const shortTermRefPicSets = [];
    for (let i = 0; i < num_short_term_ref_pic_sets; i += 1) {
      shortTermRefPicSets[i] = h265ParseShortTermReferencePictureSet(reader, i, num_short_term_ref_pic_sets, shortTermRefPicSets);
    }
    const long_term_ref_pics_present_flag = !!reader.next();
    let num_long_term_ref_pics_sps;
    let lt_ref_pic_poc_lsb_sps;
    let used_by_curr_pic_lt_sps_flag;
    if (long_term_ref_pics_present_flag) {
      num_long_term_ref_pics_sps = reader.decodeExponentialGolombNumber();
      lt_ref_pic_poc_lsb_sps = [];
      used_by_curr_pic_lt_sps_flag = [];
      for (let i = 0; i < num_long_term_ref_pics_sps; i += 1) {
        lt_ref_pic_poc_lsb_sps[i] = reader.read(log2_max_pic_order_cnt_lsb_minus4 + 4);
        used_by_curr_pic_lt_sps_flag[i] = !!reader.next();
      }
    }
    const sps_temporal_mvp_enabled_flag = !!reader.next();
    const strong_intra_smoothing_enabled_flag = !!reader.next();
    const vui_parameters_present_flag = !!reader.next();
    let vuiParameters;
    if (vui_parameters_present_flag) {
      vuiParameters = h265ParseVuiParameters(reader, sps_max_sub_layers_minus1);
    }
    const sps_extension_present_flag = !!reader.next();
    let sps_range_extension_flag;
    let sps_multilayer_extension_flag;
    let sps_3d_extension_flag;
    let sps_scc_extension_flag;
    let sps_extension_4bits;
    if (sps_extension_present_flag) {
      sps_range_extension_flag = !!reader.next();
      sps_multilayer_extension_flag = !!reader.next();
      sps_3d_extension_flag = !!reader.next();
      sps_scc_extension_flag = !!reader.next();
      sps_extension_4bits = reader.read(4);
    }
    if (sps_range_extension_flag) {
      throw new Error("Not implemented");
    }
    let spsMultilayerExtension;
    if (sps_multilayer_extension_flag) {
      spsMultilayerExtension = h265ParseSpsMultilayerExtension(reader);
    }
    let sps3dExtension;
    if (sps_3d_extension_flag) {
      sps3dExtension = h265ParseSps3dExtension(reader);
    }
    if (sps_scc_extension_flag) {
      throw new Error("Not implemented");
    }
    let sps_extension_data_flag;
    if (sps_extension_4bits) {
      sps_extension_data_flag = [];
      let i = 0;
      while (!reader.ended) {
        sps_extension_data_flag[i] = !!reader.next();
        i += 1;
      }
    }
    return {
      sps_video_parameter_set_id,
      sps_max_sub_layers_minus1,
      sps_temporal_id_nesting_flag,
      profileTierLevel,
      sps_seq_parameter_set_id,
      chroma_format_idc,
      separate_colour_plane_flag,
      pic_width_in_luma_samples,
      pic_height_in_luma_samples,
      conformance_window_flag,
      conf_win_left_offset,
      conf_win_right_offset,
      conf_win_top_offset,
      conf_win_bottom_offset,
      bit_depth_luma_minus8,
      bit_depth_chroma_minus8,
      log2_max_pic_order_cnt_lsb_minus4,
      sps_sub_layer_ordering_info_present_flag,
      sps_max_dec_pic_buffering_minus1,
      sps_max_num_reorder_pics,
      sps_max_latency_increase_plus1,
      log2_min_luma_coding_block_size_minus3,
      log2_diff_max_min_luma_coding_block_size,
      log2_min_luma_transform_block_size_minus2,
      log2_diff_max_min_luma_transform_block_size,
      max_transform_hierarchy_depth_inter,
      max_transform_hierarchy_depth_intra,
      scaling_list_enabled_flag,
      sps_scaling_list_data_present_flag,
      scalingListData,
      amp_enabled_flag,
      sample_adaptive_offset_enabled_flag,
      pcm_enabled_flag,
      pcm_sample_bit_depth_luma_minus1,
      pcm_sample_bit_depth_chroma_minus1,
      log2_min_pcm_luma_coding_block_size_minus3,
      log2_diff_max_min_pcm_luma_coding_block_size,
      pcm_loop_filter_disabled_flag,
      num_short_term_ref_pic_sets,
      shortTermRefPicSets,
      long_term_ref_pics_present_flag,
      num_long_term_ref_pics_sps,
      lt_ref_pic_poc_lsb_sps,
      used_by_curr_pic_lt_sps_flag,
      sps_temporal_mvp_enabled_flag,
      strong_intra_smoothing_enabled_flag,
      vui_parameters_present_flag,
      vuiParameters,
      sps_extension_present_flag,
      sps_range_extension_flag,
      sps_multilayer_extension_flag,
      sps_3d_extension_flag,
      sps_scc_extension_flag,
      sps_extension_4bits,
      spsMultilayerExtension,
      sps3dExtension,
      sps_extension_data_flag
    };
  }
  function h265ParseProfileTier(reader) {
    const profile_space = reader.read(2);
    const tier_flag = !!reader.next();
    const profile_idc = reader.read(5);
    const profileCompatibilitySet = reader.peekBytes(4);
    const profile_compatibility_flag = [];
    for (let j = 0; j < 32; j += 1) {
      profile_compatibility_flag[j] = !!reader.next();
    }
    const constraintSet = reader.peekBytes(6);
    const progressive_source_flag = !!reader.next();
    const interlaced_source_flag = !!reader.next();
    const non_packed_constraint_flag = !!reader.next();
    const frame_only_constraint_flag = !!reader.next();
    let max_12bit_constraint_flag;
    let max_10bit_constraint_flag;
    let max_8bit_constraint_flag;
    let max_422chroma_constraint_flag;
    let max_420chroma_constraint_flag;
    let max_monochrome_constraint_flag;
    let intra_constraint_flag;
    let one_picture_only_constraint_flag;
    let lower_bit_rate_constraint_flag;
    let max_14bit_constraint_flag;
    if (profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 6 || profile_compatibility_flag[6] || profile_idc === 7 || profile_compatibility_flag[7] || profile_idc === 8 || profile_compatibility_flag[8] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
      max_12bit_constraint_flag = !!reader.next();
      max_10bit_constraint_flag = !!reader.next();
      max_8bit_constraint_flag = !!reader.next();
      max_422chroma_constraint_flag = !!reader.next();
      max_420chroma_constraint_flag = !!reader.next();
      max_monochrome_constraint_flag = !!reader.next();
      intra_constraint_flag = !!reader.next();
      one_picture_only_constraint_flag = !!reader.next();
      lower_bit_rate_constraint_flag = !!reader.next();
      if (profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 10 || profile_compatibility_flag[10] || profile_idc === 11 || profile_compatibility_flag[11]) {
        max_14bit_constraint_flag = !!reader.next();
        reader.skip(33);
      } else {
        reader.skip(34);
      }
    } else if (profile_idc === 2 || profile_compatibility_flag[2]) {
      reader.skip(7);
      one_picture_only_constraint_flag = !!reader.next();
      reader.skip(35);
    } else {
      reader.skip(43);
    }
    let inbld_flag;
    if (profile_idc === 1 || profile_compatibility_flag[1] || profile_idc === 2 || profile_compatibility_flag[2] || profile_idc === 3 || profile_compatibility_flag[3] || profile_idc === 4 || profile_compatibility_flag[4] || profile_idc === 5 || profile_compatibility_flag[5] || profile_idc === 9 || profile_compatibility_flag[9] || profile_idc === 11 || profile_compatibility_flag[11]) {
      inbld_flag = !!reader.next();
    } else {
      reader.skip(1);
    }
    return {
      profile_space,
      tier_flag,
      profile_idc,
      profileCompatibilitySet,
      profile_compatibility_flag,
      constraintSet,
      progressive_source_flag,
      interlaced_source_flag,
      non_packed_constraint_flag,
      frame_only_constraint_flag,
      max_12bit_constraint_flag,
      max_10bit_constraint_flag,
      max_8bit_constraint_flag,
      max_422chroma_constraint_flag,
      max_420chroma_constraint_flag,
      max_monochrome_constraint_flag,
      intra_constraint_flag,
      one_picture_only_constraint_flag,
      lower_bit_rate_constraint_flag,
      max_14bit_constraint_flag,
      inbld_flag
    };
  }
  function h265ParseProfileTierLevel(reader, profilePresentFlag, maxNumSubLayersMinus1) {
    let generalProfileTier;
    if (profilePresentFlag) {
      generalProfileTier = h265ParseProfileTier(reader);
    }
    const general_level_idc = reader.read(8);
    const sub_layer_profile_present_flag = [];
    const sub_layer_level_present_flag = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      sub_layer_profile_present_flag[i] = !!reader.next();
      sub_layer_level_present_flag[i] = !!reader.next();
    }
    if (maxNumSubLayersMinus1 > 0) {
      for (let i = maxNumSubLayersMinus1; i < 8; i += 1) {
        reader.read(2);
      }
    }
    const subLayerProfileTier = [];
    const sub_layer_level_idc = [];
    for (let i = 0; i < maxNumSubLayersMinus1; i += 1) {
      if (sub_layer_profile_present_flag[i]) {
        subLayerProfileTier[i] = h265ParseProfileTier(reader);
      }
      if (sub_layer_level_present_flag[i]) {
        sub_layer_level_idc[i] = reader.read(8);
      }
    }
    return {
      generalProfileTier,
      general_level_idc,
      sub_layer_profile_present_flag,
      sub_layer_level_present_flag,
      subLayerProfileTier,
      sub_layer_level_idc
    };
  }
  function h265ParseScalingListData(reader) {
    const scaling_list = [];
    for (let sizeId = 0; sizeId < 4; sizeId += 1) {
      scaling_list[sizeId] = [];
      for (let matrixId = 0; matrixId < 6; matrixId += sizeId === 3 ? 3 : 1) {
        const scaling_list_pred_mode_flag = !!reader.next();
        if (!scaling_list_pred_mode_flag) {
          reader.decodeExponentialGolombNumber();
        } else {
          let nextCoef = 8;
          const coefNum = Math.min(64, 1 << 4 + (sizeId << 1));
          if (sizeId > 1) {
            const scaling_list_dc_coef_minus8 = reader.decodeExponentialGolombNumber();
            nextCoef = scaling_list_dc_coef_minus8 + 8;
          }
          scaling_list[sizeId][matrixId] = [];
          for (let i = 0; i < coefNum; i += 1) {
            const scaling_list_delta_coef = reader.decodeExponentialGolombNumber();
            nextCoef = (nextCoef + scaling_list_delta_coef + 256) % 256;
            scaling_list[sizeId][matrixId][i] = nextCoef;
          }
        }
      }
    }
    return scaling_list;
  }
  function h265ParseShortTermReferencePictureSet(reader, stRpsIdx, num_short_term_ref_pic_sets, sets) {
    let inter_ref_pic_set_prediction_flag = false;
    if (stRpsIdx !== 0) {
      inter_ref_pic_set_prediction_flag = !!reader.next();
    }
    let delta_idx_minus1 = 0;
    let delta_rps_sign = false;
    let abs_delta_rps_minus1 = 0;
    const used_by_curr_pic_flag = [];
    const use_delta_flag = [];
    let num_negative_pics = 0;
    let num_positive_pics = 0;
    const delta_poc_s0_minus1 = [];
    const used_by_curr_pic_s0_flag = [];
    const delta_poc_s1_minus1 = [];
    const used_by_curr_pic_s1_flag = [];
    if (inter_ref_pic_set_prediction_flag) {
      if (stRpsIdx === num_short_term_ref_pic_sets) {
        delta_idx_minus1 = reader.decodeExponentialGolombNumber();
      }
      delta_rps_sign = !!reader.next();
      abs_delta_rps_minus1 = reader.decodeExponentialGolombNumber();
      const RefRpsIdx = stRpsIdx - (delta_idx_minus1 + 1);
      const RefRps = sets[RefRpsIdx];
      const NumDeltaPocs_RefRpsIdx = RefRps.num_negative_pics + RefRps.num_positive_pics;
      for (let j = 0; j <= NumDeltaPocs_RefRpsIdx; j += 1) {
        used_by_curr_pic_flag[j] = !!reader.next();
        if (!used_by_curr_pic_flag[j]) {
          use_delta_flag[j] = !!reader.next();
        } else {
          use_delta_flag[j] = true;
        }
      }
      const DeltaRps = (1 - 2 * Number(delta_rps_sign)) * (abs_delta_rps_minus1 + 1);
      const RefPocS0 = [];
      const RefPocS1 = [];
      const pocS0 = [];
      const pocS1 = [];
      let dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_negative_pics; i2 += 1) {
        dPoc -= RefRps.delta_poc_s0_minus1[i2] + 1;
        RefPocS0[i2] = dPoc;
      }
      dPoc = 0;
      for (let i2 = 0; i2 < RefRps.num_positive_pics; i2 += 1) {
        dPoc += RefRps.delta_poc_s1_minus1[i2] + 1;
        RefPocS1[i2] = dPoc;
      }
      let i = 0;
      if (RefRps.num_positive_pics > 0) {
        for (let j = RefRps.num_positive_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS1[j] + DeltaRps;
          if (dPoc < 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
            pocS0[i] = dPoc;
            used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
            i += 1;
          }
        }
      }
      if (DeltaRps < 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS0[i] = DeltaRps;
        used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_negative_pics; j += 1) {
        dPoc = RefPocS0[j] + DeltaRps;
        if (dPoc < 0 && use_delta_flag[j]) {
          pocS0[i] = dPoc;
          used_by_curr_pic_s0_flag[i] = used_by_curr_pic_flag[j];
          i += 1;
        }
      }
      num_negative_pics = i;
      let prev = 0;
      for (i = 0; i < num_negative_pics; i += 1) {
        const current = pocS0[i];
        delta_poc_s0_minus1[i] = -(current - prev - 1);
        prev = current;
      }
      i = 0;
      if (RefRps.num_negative_pics > 0) {
        for (let j = RefRps.num_negative_pics - 1; j >= 0; j -= 1) {
          dPoc = RefPocS0[j] + DeltaRps;
          if (dPoc > 0 && use_delta_flag[j]) {
            pocS1[i] = dPoc;
            used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[j];
            i += 1;
          }
        }
      }
      if (DeltaRps > 0 && use_delta_flag[NumDeltaPocs_RefRpsIdx]) {
        pocS1[i] = DeltaRps;
        used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[NumDeltaPocs_RefRpsIdx];
        i += 1;
      }
      for (let j = 0; j < RefRps.num_positive_pics; j += 1) {
        dPoc = RefPocS1[j] + DeltaRps;
        if (dPoc > 0 && use_delta_flag[RefRps.num_negative_pics + j]) {
          pocS1[i] = dPoc;
          used_by_curr_pic_s1_flag[i] = used_by_curr_pic_flag[RefRps.num_negative_pics + j];
          i += 1;
        }
      }
      num_positive_pics = i;
      prev = 0;
      for (i = 0; i < num_positive_pics; i += 1) {
        const current = pocS1[i];
        delta_poc_s1_minus1[i] = current - prev - 1;
        prev = current;
      }
    } else {
      num_negative_pics = reader.decodeExponentialGolombNumber();
      num_positive_pics = reader.decodeExponentialGolombNumber();
      for (let i = 0; i < num_negative_pics; i += 1) {
        delta_poc_s0_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s0_flag[i] = !!reader.next();
      }
      for (let i = 0; i < num_positive_pics; i += 1) {
        delta_poc_s1_minus1[i] = reader.decodeExponentialGolombNumber();
        used_by_curr_pic_s1_flag[i] = !!reader.next();
      }
    }
    return {
      stRpsIdx,
      num_short_term_ref_pic_sets,
      inter_ref_pic_set_prediction_flag,
      delta_idx_minus1,
      delta_rps_sign,
      abs_delta_rps_minus1,
      used_by_curr_pic_flag,
      use_delta_flag,
      num_negative_pics,
      num_positive_pics,
      delta_poc_s0_minus1,
      used_by_curr_pic_s0_flag,
      delta_poc_s1_minus1,
      used_by_curr_pic_s1_flag
    };
  }
  var H265AspectRatioIndicator = {
    Unspecified: 0,
    Square: 1,
    _12_11: 2,
    _10_11: 3,
    _16_11: 4,
    _40_33: 5,
    _24_11: 6,
    _20_11: 7,
    _32_11: 8,
    _80_33: 9,
    _18_11: 10,
    _15_11: 11,
    _64_33: 12,
    _160_99: 13,
    _4_3: 15,
    _3_2: 16,
    _2_1: 17,
    Extended: 255
  };
  function h265ParseVuiParameters(reader, sps_max_sub_layers_minus1) {
    const aspect_ratio_info_present_flag = !!reader.next();
    let aspect_ratio_idc;
    let sar_width;
    let sar_height;
    if (aspect_ratio_info_present_flag) {
      aspect_ratio_idc = reader.read(8);
      if (aspect_ratio_idc === H265AspectRatioIndicator.Extended) {
        sar_width = reader.read(16);
        sar_height = reader.read(16);
      }
    }
    const overscan_info_present_flag = !!reader.next();
    let overscan_appropriate_flag;
    if (overscan_info_present_flag) {
      overscan_appropriate_flag = !!reader.next();
    }
    const video_signal_type_present_flag = !!reader.next();
    let video_format;
    let video_full_range_flag;
    let colour_description_present_flag;
    let colour_primaries;
    let transfer_characteristics;
    let matrix_coeffs;
    if (video_signal_type_present_flag) {
      video_format = reader.read(3);
      video_full_range_flag = !!reader.next();
      colour_description_present_flag = !!reader.next();
      if (colour_description_present_flag) {
        colour_primaries = reader.read(8);
        transfer_characteristics = reader.read(8);
        matrix_coeffs = reader.read(8);
      }
    }
    const chroma_loc_info_present_flag = !!reader.next();
    let chroma_sample_loc_type_top_field;
    let chroma_sample_loc_type_bottom_field;
    if (chroma_loc_info_present_flag) {
      chroma_sample_loc_type_top_field = reader.decodeExponentialGolombNumber();
      chroma_sample_loc_type_bottom_field = reader.decodeExponentialGolombNumber();
    }
    const neutral_chroma_indication_flag = !!reader.next();
    const field_seq_flag = !!reader.next();
    const frame_field_info_present_flag = !!reader.next();
    const default_display_window_flag = !!reader.next();
    let def_disp_win_left_offset;
    let def_disp_win_right_offset;
    let def_disp_win_top_offset;
    let def_disp_win_bottom_offset;
    if (default_display_window_flag) {
      def_disp_win_left_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_right_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_top_offset = reader.decodeExponentialGolombNumber();
      def_disp_win_bottom_offset = reader.decodeExponentialGolombNumber();
    }
    const vui_timing_info_present_flag = !!reader.next();
    let vui_num_units_in_tick;
    let vui_time_scale;
    let vui_poc_proportional_to_timing_flag;
    let vui_num_ticks_poc_diff_one_minus1;
    let vui_hrd_parameters_present_flag;
    let vui_hrd_parameters;
    if (vui_timing_info_present_flag) {
      vui_num_units_in_tick = reader.read(32);
      vui_time_scale = reader.read(32);
      vui_poc_proportional_to_timing_flag = !!reader.next();
      if (vui_poc_proportional_to_timing_flag) {
        vui_num_ticks_poc_diff_one_minus1 = reader.decodeExponentialGolombNumber();
      }
      vui_hrd_parameters_present_flag = !!reader.next();
      if (vui_hrd_parameters_present_flag) {
        vui_hrd_parameters = h265ParseHrdParameters(reader, true, sps_max_sub_layers_minus1);
      }
    }
    const bitstream_restriction_flag = !!reader.next();
    let tiles_fixed_structure_flag;
    let motion_vectors_over_pic_boundaries_flag;
    let restricted_ref_pic_lists_flag;
    let min_spatial_segmentation_idc;
    let max_bytes_per_pic_denom;
    let max_bits_per_min_cu_denom;
    let log2_max_mv_length_horizontal;
    let log2_max_mv_length_vertical;
    if (bitstream_restriction_flag) {
      tiles_fixed_structure_flag = !!reader.next();
      motion_vectors_over_pic_boundaries_flag = !!reader.next();
      restricted_ref_pic_lists_flag = !!reader.next();
      min_spatial_segmentation_idc = reader.decodeExponentialGolombNumber();
      max_bytes_per_pic_denom = reader.decodeExponentialGolombNumber();
      max_bits_per_min_cu_denom = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_horizontal = reader.decodeExponentialGolombNumber();
      log2_max_mv_length_vertical = reader.decodeExponentialGolombNumber();
    }
    return {
      aspect_ratio_info_present_flag,
      aspect_ratio_idc,
      sar_width,
      sar_height,
      overscan_info_present_flag,
      overscan_appropriate_flag,
      video_signal_type_present_flag,
      video_format,
      video_full_range_flag,
      colour_description_present_flag,
      colour_primaries,
      transfer_characteristics,
      matrix_coeffs,
      chroma_loc_info_present_flag,
      chroma_sample_loc_type_top_field,
      chroma_sample_loc_type_bottom_field,
      neutral_chroma_indication_flag,
      field_seq_flag,
      frame_field_info_present_flag,
      default_display_window_flag,
      def_disp_win_left_offset,
      def_disp_win_right_offset,
      def_disp_win_top_offset,
      def_disp_win_bottom_offset,
      vui_timing_info_present_flag,
      vui_num_units_in_tick,
      vui_time_scale,
      vui_poc_proportional_to_timing_flag,
      vui_num_ticks_poc_diff_one_minus1,
      vui_hrd_parameters_present_flag,
      vui_hrd_parameters,
      bitstream_restriction_flag,
      tiles_fixed_structure_flag,
      motion_vectors_over_pic_boundaries_flag,
      restricted_ref_pic_lists_flag,
      min_spatial_segmentation_idc,
      max_bytes_per_pic_denom,
      max_bits_per_min_cu_denom,
      log2_max_mv_length_horizontal,
      log2_max_mv_length_vertical
    };
  }
  function h265ParseHrdParameters(reader, commonInfPresentFlag, maxNumSubLayersMinus1) {
    let nal_hrd_parameters_present_flag;
    let vcl_hrd_parameters_present_flag;
    let sub_pic_hrd_params_present_flag;
    let tick_divisor_minus2;
    let du_cpb_removal_delay_increment_length_minus1;
    let sub_pic_cpb_params_in_pic_timing_sei_flag;
    let dpb_output_delay_du_length_minus1;
    let bit_rate_scale;
    let cpb_size_scale;
    let cpb_size_du_scale;
    let initial_cpb_removal_delay_length_minus1;
    let au_cpb_removal_delay_length_minus1;
    let dpb_output_delay_length_minus1;
    if (commonInfPresentFlag) {
      nal_hrd_parameters_present_flag = !!reader.next();
      vcl_hrd_parameters_present_flag = !!reader.next();
      if (nal_hrd_parameters_present_flag || vcl_hrd_parameters_present_flag) {
        sub_pic_hrd_params_present_flag = !!reader.next();
        if (sub_pic_hrd_params_present_flag) {
          tick_divisor_minus2 = reader.read(8);
          du_cpb_removal_delay_increment_length_minus1 = reader.read(5);
          sub_pic_cpb_params_in_pic_timing_sei_flag = !!reader.next();
          dpb_output_delay_du_length_minus1 = reader.read(5);
        }
        bit_rate_scale = reader.read(4);
        cpb_size_scale = reader.read(4);
        if (sub_pic_hrd_params_present_flag) {
          cpb_size_du_scale = reader.read(4);
        }
        initial_cpb_removal_delay_length_minus1 = reader.read(5);
        au_cpb_removal_delay_length_minus1 = reader.read(5);
        dpb_output_delay_length_minus1 = reader.read(5);
      }
    }
    const fixed_pic_rate_general_flag = [];
    const fixed_pic_rate_within_cvs_flag = [];
    const elemental_duration_in_tc_minus1 = [];
    const low_delay_hrd_flag = [];
    const cpb_cnt_minus1 = [];
    const nalHrdParameters = [];
    const vclHrdParameters = [];
    for (let i = 0; i <= maxNumSubLayersMinus1; i += 1) {
      fixed_pic_rate_general_flag[i] = !!reader.next();
      if (!fixed_pic_rate_general_flag[i]) {
        fixed_pic_rate_within_cvs_flag[i] = !!reader.next();
      }
      if (fixed_pic_rate_within_cvs_flag[i]) {
        elemental_duration_in_tc_minus1[i] = reader.decodeExponentialGolombNumber();
      } else {
        low_delay_hrd_flag[i] = !!reader.next();
      }
      if (!low_delay_hrd_flag[i]) {
        cpb_cnt_minus1[i] = reader.decodeExponentialGolombNumber();
      }
      if (nal_hrd_parameters_present_flag) {
        nalHrdParameters[i] = h265ParseSubLayerHrdParameters(reader, i, getCpbCnt(cpb_cnt_minus1[i]));
      }
      if (vcl_hrd_parameters_present_flag) {
        vclHrdParameters[i] = h265ParseSubLayerHrdParameters(reader, i, getCpbCnt(cpb_cnt_minus1[i]));
      }
    }
    return {
      nal_hrd_parameters_present_flag,
      vcl_hrd_parameters_present_flag,
      sub_pic_hrd_params_present_flag,
      tick_divisor_minus2,
      du_cpb_removal_delay_increment_length_minus1,
      sub_pic_cpb_params_in_pic_timing_sei_flag,
      dpb_output_delay_du_length_minus1,
      bit_rate_scale,
      cpb_size_scale,
      cpb_size_du_scale,
      initial_cpb_removal_delay_length_minus1,
      au_cpb_removal_delay_length_minus1,
      dpb_output_delay_length_minus1,
      fixed_pic_rate_general_flag,
      fixed_pic_rate_within_cvs_flag,
      elemental_duration_in_tc_minus1,
      low_delay_hrd_flag,
      cpb_cnt_minus1,
      nalHrdParameters,
      vclHrdParameters
    };
  }
  function h265ParseSubLayerHrdParameters(reader, subLayerId, CpbCnt) {
    const bit_rate_value_minus1 = [];
    const cpb_size_value_minus1 = [];
    const cpb_size_du_value_minus1 = [];
    const bit_rate_du_value_minus1 = [];
    const cbr_flag = [];
    for (let i = 0; i < CpbCnt; i += 1) {
      bit_rate_value_minus1[i] = reader.decodeExponentialGolombNumber();
      cpb_size_value_minus1[i] = reader.decodeExponentialGolombNumber();
      if (subLayerId > 0) {
        cbr_flag[i] = !!reader.next();
      }
    }
    return {
      bit_rate_value_minus1,
      cpb_size_value_minus1,
      cpb_size_du_value_minus1,
      bit_rate_du_value_minus1,
      cbr_flag
    };
  }
  function getCpbCnt(cpb_cnt_minus_1) {
    return cpb_cnt_minus_1 + 1;
  }
  function h265SearchConfiguration(buffer2) {
    let videoParameterSet;
    let sequenceParameterSet;
    let pictureParameterSet;
    let count = 0;
    for (const nalu of annexBSplitNalu(buffer2)) {
      const header = h265ParseNaluHeader(nalu);
      const raw = {
        ...header,
        data: nalu,
        rbsp: nalu.subarray(2)
      };
      switch (header.nal_unit_type) {
        case 32:
          videoParameterSet = raw;
          break;
        case 33:
          sequenceParameterSet = raw;
          break;
        case 34:
          pictureParameterSet = raw;
          break;
        default:
          continue;
      }
      count += 1;
      if (count === 3) {
        return {
          videoParameterSet,
          sequenceParameterSet,
          pictureParameterSet
        };
      }
    }
    throw new Error("Invalid data");
  }
  function h265ParseSpsMultilayerExtension(reader) {
    const inter_view_mv_vert_constraint_flag = !!reader.next();
    return {
      inter_view_mv_vert_constraint_flag
    };
  }
  function h265ParseSps3dExtension(reader) {
    const iv_di_mc_enabled_flag = [];
    const iv_mv_scal_enabled_flag = [];
    iv_di_mc_enabled_flag[0] = !!reader.next();
    iv_mv_scal_enabled_flag[0] = !!reader.next();
    const log2_ivmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const iv_res_pred_enabled_flag = !!reader.next();
    const depth_ref_enabled_flag = !!reader.next();
    const vsp_mc_enabled_flag = !!reader.next();
    const dbbp_enabled_flag = !!reader.next();
    iv_di_mc_enabled_flag[1] = !!reader.next();
    iv_mv_scal_enabled_flag[1] = !!reader.next();
    const tex_mc_enabled_flag = !!reader.next();
    const log2_texmc_sub_pb_size_minus3 = reader.decodeExponentialGolombNumber();
    const intra_contour_enabled_flag = !!reader.next();
    const intra_dc_only_wedge_enabled_flag = !!reader.next();
    const cqt_cu_part_pred_enabled_flag = !!reader.next();
    const inter_dc_only_enabled_flag = !!reader.next();
    const skip_intra_enabled_flag = !!reader.next();
    return {
      iv_di_mc_enabled_flag,
      iv_mv_scal_enabled_flag,
      log2_ivmc_sub_pb_size_minus3,
      iv_res_pred_enabled_flag,
      depth_ref_enabled_flag,
      vsp_mc_enabled_flag,
      dbbp_enabled_flag,
      tex_mc_enabled_flag,
      log2_texmc_sub_pb_size_minus3,
      intra_contour_enabled_flag,
      intra_dc_only_wedge_enabled_flag,
      cqt_cu_part_pred_enabled_flag,
      inter_dc_only_enabled_flag,
      skip_intra_enabled_flag
    };
  }
  function h265ParseConfiguration(data) {
    const { videoParameterSet, sequenceParameterSet, pictureParameterSet } = h265SearchConfiguration(data);
    const { profileTierLevel: { generalProfileTier: { profile_space: generalProfileSpace, tier_flag: generalTierFlag, profile_idc: generalProfileIndex, profileCompatibilitySet: generalProfileCompatibilitySet, constraintSet: generalConstraintSet }, general_level_idc: generalLevelIndex } } = h265ParseVideoParameterSet(videoParameterSet.rbsp);
    const { chroma_format_idc, pic_width_in_luma_samples: encodedWidth, pic_height_in_luma_samples: encodedHeight, conf_win_left_offset: cropLeft = 0, conf_win_right_offset: cropRight = 0, conf_win_top_offset: cropTop = 0, conf_win_bottom_offset: cropBottom = 0 } = h265ParseSequenceParameterSet(sequenceParameterSet.rbsp);
    const SubWidthC = getSubWidthC(chroma_format_idc);
    const SubHeightC = getSubHeightC(chroma_format_idc);
    const croppedWidth = encodedWidth - SubWidthC * (cropLeft + cropRight);
    const croppedHeight = encodedHeight - SubHeightC * (cropTop + cropBottom);
    return {
      videoParameterSet,
      sequenceParameterSet,
      pictureParameterSet,
      generalProfileSpace,
      generalProfileIndex,
      generalProfileCompatibilitySet,
      generalTierFlag,
      generalLevelIndex,
      generalConstraintSet,
      encodedWidth,
      encodedHeight,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom,
      croppedWidth,
      croppedHeight
    };
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/connection.js
  var SCRCPY_SOCKET_NAME_PREFIX = "scrcpy";
  var AdbScrcpyConnection = class {
    adb;
    options;
    socketName;
    constructor(adb, options) {
      this.adb = adb;
      this.options = options;
      this.socketName = this.getSocketName();
    }
    initialize() {
    }
    getSocketName() {
      let socketName = "localabstract:" + SCRCPY_SOCKET_NAME_PREFIX;
      if (this.options.scid !== void 0) {
        socketName += "_" + this.options.scid.padStart(8, "0");
      }
      return socketName;
    }
    dispose() {
    }
  };
  var AdbScrcpyForwardConnection = class extends AdbScrcpyConnection {
    #disposed = false;
    #connect() {
      return this.adb.createSocket(this.socketName);
    }
    async #connectAndRetry(sendDummyByte) {
      for (let i = 0; !this.#disposed && i < 100; i += 1) {
        try {
          const stream = await this.#connect();
          if (sendDummyByte) {
            const buffered = new BufferedReadableStream(stream.readable);
            await buffered.readExactly(1);
            return {
              readable: buffered.release(),
              writable: stream.writable
            };
          }
          return stream;
        } catch {
          await delay(100);
        }
      }
      throw new Error(`Can't connect to server after 100 retries`);
    }
    async getStreams() {
      let { sendDummyByte } = this.options;
      const streams = {};
      if (this.options.video) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.video = stream.readable;
        sendDummyByte = false;
      }
      if (this.options.audio) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.audio = stream.readable;
        sendDummyByte = false;
      }
      if (this.options.control) {
        const stream = await this.#connectAndRetry(sendDummyByte);
        streams.control = stream;
        sendDummyByte = false;
      }
      return streams;
    }
    dispose() {
      this.#disposed = true;
    }
  };
  var AdbScrcpyReverseConnection = class extends AdbScrcpyConnection {
    #streams;
    #address;
    async initialize() {
      await this.adb.reverse.remove(this.socketName).catch((e) => {
        if (e instanceof AdbReverseNotSupportedError) {
          throw e;
        }
      });
      let queueController;
      const queue = new PushReadableStream((controller) => {
        queueController = controller;
      });
      this.#streams = queue.getReader();
      this.#address = await this.adb.reverse.add(this.socketName, async (socket) => {
        await queueController.enqueue(socket);
      });
    }
    async #accept() {
      return (await this.#streams.read()).value;
    }
    async getStreams() {
      const streams = {};
      if (this.options.video) {
        const stream = await this.#accept();
        streams.video = stream.readable;
      }
      if (this.options.audio) {
        const stream = await this.#accept();
        streams.audio = stream.readable;
      }
      if (this.options.control) {
        const stream = await this.#accept();
        streams.control = stream;
      }
      return streams;
    }
    dispose() {
      this.adb.reverse.remove(this.#address).catch(NOOP2);
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/video.js
  var AdbScrcpyVideoStream = class {
    #options;
    #metadata;
    get metadata() {
      return this.#metadata;
    }
    #stream;
    get stream() {
      return this.#stream;
    }
    #sizeChanged = new StickyEventEmitter();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    constructor(options, metadata, stream) {
      this.#options = options;
      this.#metadata = metadata;
      this.#stream = stream.pipeThrough(this.#options.createMediaStreamTransformer()).pipeThrough(new InspectStream((packet) => {
        if (packet.type === "configuration") {
          switch (metadata.codec) {
            case ScrcpyVideoCodecId.H264:
              this.#configureH264(packet.data);
              break;
            case ScrcpyVideoCodecId.H265:
              this.#configureH265(packet.data);
              break;
            case ScrcpyVideoCodecId.AV1:
              break;
          }
        } else if (metadata.codec === ScrcpyVideoCodecId.AV1) {
          this.#configureAv1(packet.data);
        }
      }));
    }
    #configureH264(data) {
      const { croppedWidth, croppedHeight } = h264ParseConfiguration(data);
      this.#width = croppedWidth;
      this.#height = croppedHeight;
      this.#sizeChanged.fire({ width: croppedWidth, height: croppedHeight });
    }
    #configureH265(data) {
      const { croppedWidth, croppedHeight } = h265ParseConfiguration(data);
      this.#width = croppedWidth;
      this.#height = croppedHeight;
      this.#sizeChanged.fire({ width: croppedWidth, height: croppedHeight });
    }
    #configureAv1(data) {
      const parser = new Av1(data);
      const sequenceHeader = parser.searchSequenceHeaderObu();
      if (!sequenceHeader) {
        return;
      }
      const { max_frame_width_minus_1, max_frame_height_minus_1 } = sequenceHeader;
      const width = max_frame_width_minus_1 + 1;
      const height = max_frame_height_minus_1 + 1;
      this.#width = width;
      this.#height = height;
      this.#sizeChanged.fire({ width, height });
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/client.js
  function arrayToStream(array) {
    return new PushReadableStream(async (controller) => {
      for (const item of array) {
        await controller.enqueue(item);
      }
    });
  }
  function concatStreams(...streams) {
    return new PushReadableStream(async (controller) => {
      for (const stream of streams) {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          await controller.enqueue(value);
        }
      }
    });
  }
  var AdbScrcpyExitedError = class extends Error {
    output;
    constructor(output) {
      super("scrcpy server exited prematurely");
      this.output = output;
    }
  };
  var AdbScrcpyClient = class _AdbScrcpyClient {
    static async pushServer(adb, file, filename = DefaultServerPath) {
      const sync = await adb.sync();
      try {
        await sync.write({
          filename,
          file
        });
      } finally {
        await sync.dispose();
      }
    }
    static async start(adb, path, options) {
      let connection;
      let process;
      try {
        try {
          connection = options.createConnection(adb);
          await connection.initialize();
        } catch (e) {
          if (e instanceof AdbReverseNotSupportedError) {
            options.value.tunnelForward = true;
            connection = options.createConnection(adb);
            await connection.initialize();
          } else {
            connection = void 0;
            throw e;
          }
        }
        const args = [
          `CLASSPATH=${path}`,
          // Set environment variable
          "app_process",
          "/",
          // Parent dir (unused but required)
          "com.genymobile.scrcpy.Server",
          options.version,
          ...options.serialize()
        ];
        if (options.spawner) {
          process = await options.spawner.spawn(args);
        } else {
          process = await adb.subprocess.noneProtocol.spawn(args);
        }
        const output = process.output.pipeThrough(new TextDecoderStream()).pipeThrough(new SplitStringStream("\n"));
        const lines = [];
        const abortController = new AbortController2();
        const pipe = output.pipeTo(new WritableStream({
          write(chunk) {
            lines.push(chunk);
          }
        }), {
          signal: abortController.signal,
          preventCancel: true
        }).catch((e) => {
          if (abortController.signal.aborted) {
            return;
          }
          throw e;
        });
        const streams = await Promise.race([
          process.exited.then(() => {
            throw new AdbScrcpyExitedError(lines);
          }),
          connection.getStreams()
        ]);
        abortController.abort();
        await pipe;
        return new _AdbScrcpyClient({
          options,
          process,
          output: concatStreams(arrayToStream(lines), output),
          videoStream: streams.video,
          audioStream: streams.audio,
          controlStream: streams.control
        });
      } catch (e) {
        await process?.kill();
        throw e;
      } finally {
        connection?.dispose();
      }
    }
    /**
     * This method will modify the given `options`,
     * so don't reuse it elsewhere.
     */
    static getEncoders(adb, path, options) {
      options.setListEncoders();
      return options.getEncoders(adb, path);
    }
    /**
     * This method will modify the given `options`,
     * so don't reuse it elsewhere.
     */
    static getDisplays(adb, path, options) {
      options.setListDisplays();
      return options.getDisplays(adb, path);
    }
    #options;
    #process;
    #output;
    get output() {
      return this.#output;
    }
    get exited() {
      return this.#process.exited;
    }
    #videoStream;
    /**
     * Gets a `Promise` that resolves to the parsed video stream.
     *
     * On server version 2.1 and above, it will be `undefined` if
     * video is disabled by `options.video: false`.
     *
     * Note: if it's not `undefined`, it must be consumed to prevent
     * the connection from being blocked.
     */
    get videoStream() {
      return this.#videoStream;
    }
    #audioStream;
    /**
     * Gets a `Promise` that resolves to the parsed audio stream.
     *
     * On server versions before 2.0, it will always be `undefined`.
     * On server version 2.0 and above, it will be `undefined` if
     * audio is disabled by `options.audio: false`.
     *
     * Note: if it's not `undefined`, it must be consumed to prevent
     * the connection from being blocked.
     */
    get audioStream() {
      return this.#audioStream;
    }
    #controller;
    /**
     * Gets the control message writer.
     *
     * On server version 1.22 and above, it will be `undefined` if
     * control is disabled by `options.control: false`.
     */
    get controller() {
      return this.#controller;
    }
    get clipboard() {
      return this.#options.clipboard;
    }
    constructor({ options, process, output, videoStream, audioStream, controlStream }) {
      this.#options = options;
      this.#process = process;
      this.#output = output;
      this.#videoStream = videoStream ? this.#createVideoStream(videoStream) : void 0;
      this.#audioStream = audioStream ? this.#createAudioStream(audioStream) : void 0;
      if (controlStream) {
        this.#controller = new ScrcpyControlMessageWriter(controlStream.writable.getWriter(), options);
        this.#parseDeviceMessages(controlStream.readable).catch(() => {
        });
      }
    }
    async #parseDeviceMessages(controlStream) {
      const buffered = new BufferedReadableStream(controlStream);
      try {
        while (true) {
          let id;
          try {
            const result = await buffered.readExactly(1);
            id = result[0];
          } catch (e) {
            if (e instanceof ExactReadableEndedError) {
              this.#options.deviceMessageParsers.close();
              break;
            }
            throw e;
          }
          await this.#options.deviceMessageParsers.parse(id, buffered);
        }
      } catch (e) {
        this.#options.deviceMessageParsers.error(e);
        await tryCancel(buffered);
      }
    }
    async #createVideoStream(initialStream) {
      const { metadata, stream } = await this.#options.parseVideoStreamMetadata(initialStream);
      return new AdbScrcpyVideoStream(this.#options, metadata, stream);
    }
    async #createAudioStream(initialStream) {
      if (!this.#options.parseAudioStreamMetadata) {
        throw new Error("parsing audio stream is not supported in this version");
      }
      const metadata = await this.#options.parseAudioStreamMetadata(initialStream);
      switch (metadata.type) {
        case "disabled":
        case "errored":
          return metadata;
        case "success":
          return {
            ...metadata,
            stream: metadata.stream.pipeThrough(this.#options.createMediaStreamTransformer())
          };
        default:
          throw new Error(`Unexpected audio metadata type ${metadata["type"]}`);
      }
    }
    async close() {
      await this.#process.kill();
    }
  };

  // node_modules/@yume-chan/adb-scrcpy/esm/1_15/impl/get-displays.js
  async function getDisplays(adb, path, options) {
    try {
      const client = await AdbScrcpyClient.start(adb, path, options);
      await client.close();
      throw new Error("Unexpected server output");
    } catch (e) {
      if (e instanceof AdbScrcpyExitedError) {
        if (e.output[0]?.startsWith("[server] ERROR:")) {
          throw e;
        }
        const displays = [];
        for (const line of e.output) {
          const display = options.parseDisplay(line);
          if (display) {
            displays.push(display);
          }
        }
        return displays;
      }
      throw e;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/2_0/impl/get-encoders.js
  async function getEncoders(adb, path, options) {
    try {
      const client = await AdbScrcpyClient.start(adb, path, options);
      await client.close();
      throw new Error("Unexpected server output");
    } catch (e) {
      if (e instanceof AdbScrcpyExitedError) {
        if (e.output[0]?.startsWith("[server] ERROR:")) {
          throw e;
        }
        const encoders = [];
        for (const line of e.output) {
          const encoder = options.parseEncoder(line);
          if (encoder) {
            encoders.push(encoder);
          }
        }
        return encoders;
      }
      throw e;
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/2_1/impl/create-connection.js
  function createConnection(adb, options) {
    const connectionOptions = {
      scid: toScrcpyOptionValue(options.scid, void 0),
      video: options.video,
      audio: options.audio,
      control: options.control,
      sendDummyByte: options.sendDummyByte
    };
    if (options.tunnelForward) {
      return new AdbScrcpyForwardConnection(adb, connectionOptions);
    } else {
      return new AdbScrcpyReverseConnection(adb, connectionOptions);
    }
  }

  // node_modules/@yume-chan/adb-scrcpy/esm/3_3_3.js
  var AdbScrcpyOptions3_3_3 = class extends ScrcpyOptions3_3_1 {
    version;
    spawner;
    constructor(init, clientOptions) {
      super(init);
      this.version = clientOptions?.version ?? "3.3.3";
      this.spawner = clientOptions?.spawner;
    }
    getEncoders(adb, path) {
      return getEncoders(adb, path, this);
    }
    getDisplays(adb, path) {
      return getDisplays(adb, path, this);
    }
    createConnection(adb) {
      return createConnection(adb, this.value);
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/utils.js
  function hexDigits(value) {
    return value.toString(16).toUpperCase();
  }
  function hexTwoDigits(value) {
    return value.toString(16).toUpperCase().padStart(2, "0");
  }
  function decimalTwoDigits(value) {
    return value.toString(10).padStart(2, "0");
  }

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/av1.js
  var Av1Codec = class {
    #decoder;
    #updateSize;
    #options;
    #config;
    #configured = false;
    constructor(decoder, updateSize, options) {
      this.#decoder = decoder;
      this.#updateSize = updateSize;
      this.#options = options;
    }
    #parseConfig(data) {
      const parser = new Av1(data);
      const sequenceHeader = parser.searchSequenceHeaderObu();
      if (!sequenceHeader) {
        return;
      }
      const { seq_profile: seqProfile, seq_level_idx: [seqLevelIdx = 0], max_frame_width_minus_1, max_frame_height_minus_1, color_config: { BitDepth, mono_chrome: monoChrome, subsampling_x: subsamplingX, subsampling_y: subsamplingY, chroma_sample_position: chromaSamplePosition, color_description_present_flag } } = sequenceHeader;
      let colorPrimaries;
      let transferCharacteristics;
      let matrixCoefficients;
      let colorRange;
      if (color_description_present_flag) {
        ({
          color_primaries: colorPrimaries,
          transfer_characteristics: transferCharacteristics,
          matrix_coefficients: matrixCoefficients,
          color_range: colorRange
        } = sequenceHeader.color_config);
      } else {
        colorPrimaries = Av1.ColorPrimaries.Bt709;
        transferCharacteristics = Av1.TransferCharacteristics.Bt709;
        matrixCoefficients = Av1.MatrixCoefficients.Bt709;
        colorRange = false;
      }
      const width = max_frame_width_minus_1 + 1;
      const height = max_frame_height_minus_1 + 1;
      this.#updateSize(width, height);
      const codec = [
        "av01",
        seqProfile.toString(16),
        decimalTwoDigits(seqLevelIdx) + (sequenceHeader.seq_tier[0] ? "H" : "M"),
        decimalTwoDigits(BitDepth),
        monoChrome ? "1" : "0",
        (subsamplingX ? "1" : "0") + (subsamplingY ? "1" : "0") + chromaSamplePosition.toString(),
        decimalTwoDigits(colorPrimaries),
        decimalTwoDigits(transferCharacteristics),
        decimalTwoDigits(matrixCoefficients),
        colorRange ? "1" : "0"
      ].join(".");
      this.#config = {
        codec,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
      this.#configured = false;
    }
    decode(packet) {
      if (packet.type === "configuration") {
        return;
      }
      this.#parseConfig(packet.data);
      if (!this.#config) {
        throw new Error("Decoder not configured");
      }
      if (packet.keyframe) {
        if (this.#decoder.decodeQueueSize) {
          this.#decoder.reset();
          this.#decoder.configure(this.#config);
          this.#configured = true;
        } else if (!this.#configured) {
          this.#decoder.configure(this.#config);
          this.#configured = true;
        }
      }
      this.#decoder.decode(new EncodedVideoChunk({
        // AV1 requires Scrcpy 2.0 where `keyframe` flag must be set
        type: packet.keyframe ? "key" : "delta",
        timestamp: 0,
        data: packet.data
      }));
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h26x.js
  var H26xDecoder = class {
    #decoder;
    #config;
    #configured = false;
    constructor(decoder) {
      this.#decoder = decoder;
    }
    #configureAndDecodeFirstKeyframe(config, packet) {
      this.#decoder.configure(config);
      this.#configured = true;
      const { raw } = config;
      const data = new Uint8Array(raw.length + packet.data.length);
      data.set(raw, 0);
      data.set(packet.data, raw.length);
      this.#decoder.decode(new EncodedVideoChunk({
        type: "key",
        timestamp: 0,
        data
      }));
    }
    decode(packet) {
      if (packet.type === "configuration") {
        this.#config = {
          ...this.configure(packet.data),
          raw: packet.data
        };
        this.#configured = false;
        return;
      }
      if (!this.#config) {
        throw new Error("Decoder not configured");
      }
      if (packet.keyframe) {
        if (this.#decoder.decodeQueueSize) {
          this.#decoder.reset();
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
        if (!this.#configured) {
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
      }
      if (!this.#configured) {
        if (packet.keyframe === void 0) {
          this.#configureAndDecodeFirstKeyframe(this.#config, packet);
          return;
        }
        throw new Error("Expect a keyframe but got a delta frame");
      }
      this.#decoder.decode(new EncodedVideoChunk({
        // Treat `undefined` as `key`, otherwise won't decode.
        type: packet.keyframe === false ? "delta" : "key",
        timestamp: 0,
        data: packet.data
      }));
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h264.js
  var H264Decoder = class extends H26xDecoder {
    #updateSize;
    #options;
    constructor(decoder, updateSize, options) {
      super(decoder);
      this.#updateSize = updateSize;
      this.#options = options;
    }
    configure(data) {
      const { profileIndex, constraintSet, levelIndex, croppedWidth, croppedHeight } = h264ParseConfiguration(data);
      this.#updateSize(croppedWidth, croppedHeight);
      const codec = "avc1." + hexTwoDigits(profileIndex) + hexTwoDigits(constraintSet) + hexTwoDigits(levelIndex);
      return {
        codec,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/codec/h265.js
  var H265Decoder = class extends H26xDecoder {
    #updateSize;
    #options;
    constructor(decoder, updateSize, options) {
      super(decoder);
      this.#updateSize = updateSize;
      this.#options = options;
    }
    configure(data) {
      const { generalProfileSpace, generalProfileIndex, generalProfileCompatibilitySet, generalTierFlag, generalLevelIndex, generalConstraintSet, croppedWidth, croppedHeight } = h265ParseConfiguration(data);
      this.#updateSize(croppedWidth, croppedHeight);
      const codec = [
        "hev1",
        ["", "A", "B", "C"][generalProfileSpace] + generalProfileIndex.toString(),
        hexDigits(getUint32LittleEndian(generalProfileCompatibilitySet, 0)),
        (generalTierFlag ? "H" : "L") + generalLevelIndex.toString(),
        ...Array.from(generalConstraintSet, hexDigits)
      ].join(".");
      return {
        codec,
        // Microsoft Edge requires explicit size to work
        codedWidth: croppedWidth,
        codedHeight: croppedHeight,
        hardwareAcceleration: this.#options?.hardwareAcceleration ?? "no-preference",
        optimizeForLatency: true
      };
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/pool.js
  var Pool = class {
    #controller;
    #readable = new ReadableStream({
      start: (controller) => {
        this.#controller = controller;
      },
      pull: (controller) => {
        controller.enqueue(this.#initializer());
      }
    }, { highWaterMark: 0 });
    #reader = this.#readable.getReader();
    #initializer;
    #size = 0;
    #capacity;
    constructor(initializer, capacity) {
      this.#initializer = initializer;
      this.#capacity = capacity;
    }
    async borrow() {
      const result = await this.#reader.read();
      return result.value;
    }
    return(value) {
      if (this.#size < this.#capacity) {
        this.#controller.enqueue(value);
        this.#size += 1;
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/snapshot.js
  var VideoFrameCapturer = class {
    #canvas;
    #context;
    constructor() {
      if (typeof OffscreenCanvas !== "undefined") {
        this.#canvas = new OffscreenCanvas(1, 1);
      } else {
        this.#canvas = document.createElement("canvas");
        this.#canvas.width = 1;
        this.#canvas.height = 1;
      }
      this.#context = this.#canvas.getContext("bitmaprenderer", {
        alpha: false
      });
    }
    async capture(frame) {
      this.#canvas.width = frame.displayWidth;
      this.#canvas.height = frame.displayHeight;
      const bitmap = await createImageBitmap(frame);
      this.#context.transferFromImageBitmap(bitmap);
      if (this.#canvas instanceof OffscreenCanvas) {
        return await this.#canvas.convertToBlob({
          type: "image/png"
        });
      } else {
        return new Promise((resolve, reject) => {
          this.#canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to convert canvas to blob"));
            } else {
              resolve(blob);
            }
          }, "image/png");
        });
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/decoder.js
  var VideoFrameCapturerPool = /* @__PURE__ */ new Pool(() => new VideoFrameCapturer(), 4);
  var WebCodecsVideoDecoder = class {
    static get isSupported() {
      return typeof globalThis.VideoDecoder !== "undefined";
    }
    static capabilities = {
      h264: {},
      h265: {},
      av1: {}
    };
    #codec;
    get codec() {
      return this.#codec;
    }
    #renderer;
    get renderer() {
      return this.#renderer;
    }
    #options;
    #codecDecoder;
    #writable;
    get writable() {
      return this.#writable;
    }
    #error;
    #controller;
    #framesDraw = 0;
    #framesPresented = 0;
    get framesRendered() {
      return this.#framesPresented;
    }
    #framesSkipped = 0;
    get framesSkipped() {
      return this.#framesSkipped;
    }
    #sizeChanged = new StickyEventEmitter();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    #decoder;
    #drawing = false;
    #nextFrame;
    #captureFrame;
    #animationFrameId = 0;
    /**
     * Create a new WebCodecs video decoder.
     */
    constructor({ codec, renderer, ...options }) {
      this.#codec = codec;
      this.#renderer = renderer;
      this.#options = options;
      this.#decoder = new VideoDecoder({
        output: (frame) => {
          this.#captureFrame?.close();
          this.#captureFrame = frame.clone();
          if (this.#drawing) {
            if (this.#nextFrame) {
              this.#nextFrame.close();
              this.#framesSkipped += 1;
            }
            this.#nextFrame = frame;
            return;
          }
          void this.#draw(frame);
        },
        error: (error) => {
          this.#setError(error);
        }
      });
      switch (this.#codec) {
        case ScrcpyVideoCodecId.H264:
          this.#codecDecoder = new H264Decoder(this.#decoder, this.#updateSize, this.#options);
          break;
        case ScrcpyVideoCodecId.H265:
          this.#codecDecoder = new H265Decoder(this.#decoder, this.#updateSize, this.#options);
          break;
        case ScrcpyVideoCodecId.AV1:
          this.#codecDecoder = new Av1Codec(this.#decoder, this.#updateSize, this.#options);
          break;
        default:
          throw new Error(`Unsupported codec: ${this.#codec}`);
      }
      this.#writable = new WritableStream({
        start: (controller) => {
          if (this.#error) {
            controller.error(this.#error);
          } else {
            this.#controller = controller;
          }
        },
        write: (packet) => {
          this.#codecDecoder.decode(packet);
        }
      });
      this.#handleAnimationFrame();
    }
    #setError(error) {
      if (this.#controller) {
        try {
          this.#controller.error(error);
        } catch {
        }
      } else {
        this.#error = error;
      }
    }
    async #draw(frame) {
      try {
        this.#drawing = true;
        this.#updateSize(frame.displayWidth, frame.displayHeight);
        await this.#renderer.draw(frame);
        this.#framesDraw += 1;
        frame.close();
        if (this.#nextFrame) {
          const frame2 = this.#nextFrame;
          this.#nextFrame = void 0;
          await this.#draw(frame2);
        }
        this.#drawing = false;
      } catch (error) {
        this.#setError(error);
      }
    }
    #updateSize = (width, height) => {
      this.#renderer.setSize(width, height);
      this.#width = width;
      this.#height = height;
      this.#sizeChanged.fire({ width, height });
    };
    #handleAnimationFrame = () => {
      if (this.#framesDraw > 0) {
        this.#framesPresented += 1;
        this.#framesSkipped += this.#framesDraw - 1;
        this.#framesDraw = 0;
      }
      this.#animationFrameId = requestAnimationFrame(this.#handleAnimationFrame);
    };
    async snapshot() {
      const frame = this.#captureFrame;
      if (!frame) {
        return void 0;
      }
      const capturer = await VideoFrameCapturerPool.borrow();
      const result = await capturer.capture(frame);
      VideoFrameCapturerPool.return(capturer);
      return result;
    }
    dispose() {
      cancelAnimationFrame(this.#animationFrameId);
      if (this.#decoder.state !== "closed") {
        this.#decoder.close();
      }
      this.#nextFrame?.close();
      this.#captureFrame?.close();
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/decoder.js
  var import_yuv_buffer = __toESM(require_yuv_buffer(), 1);
  var import_yuv_canvas = __toESM(require_yuv_canvas(), 1);

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/wrapper.js
  var import_meta = {};
  var worker;
  var workerReady = false;
  var pendingResolvers = [];
  var streamId = 0;
  var PICTURE_READY_SUBSCRIPTIONS = /* @__PURE__ */ new Map();
  function subscribePictureReady(streamId2, handler) {
    PICTURE_READY_SUBSCRIPTIONS.set(streamId2, handler);
    return {
      dispose() {
        PICTURE_READY_SUBSCRIPTIONS.delete(streamId2);
      }
    };
  }
  var TinyH264Wrapper = class extends AutoDisposable {
    streamId;
    #pictureReadyEvent = new EventEmitter();
    get onPictureReady() {
      return this.#pictureReadyEvent.event;
    }
    constructor(streamId2) {
      super();
      this.streamId = streamId2;
      this.addDisposable(subscribePictureReady(streamId2, this.#handlePictureReady));
    }
    #handlePictureReady = (e) => {
      this.#pictureReadyEvent.fire(e);
    };
    feed(data) {
      worker.postMessage({
        type: "decode",
        data,
        offset: 0,
        length: data.byteLength,
        renderStateId: this.streamId
      }, [data]);
    }
    dispose() {
      super.dispose();
      worker.postMessage({
        type: "release",
        renderStateId: this.streamId
      });
    }
  };
  function createTinyH264Wrapper() {
    if (!worker) {
      worker = new Worker(new URL("./worker.js", import_meta.url), {
        type: "module"
      });
      worker.addEventListener("message", ({ data }) => {
        switch (data.type) {
          case "decoderReady":
            workerReady = true;
            for (const resolver of pendingResolvers) {
              resolver.resolve(new TinyH264Wrapper(streamId));
              streamId += 1;
            }
            pendingResolvers.length = 0;
            break;
          case "pictureReady":
            PICTURE_READY_SUBSCRIPTIONS.get(data.renderStateId)?.(data);
            break;
        }
      });
    }
    if (!workerReady) {
      const resolver = new PromiseResolver();
      pendingResolvers.push(resolver);
      return resolver.promise;
    }
    const decoder = new TinyH264Wrapper(streamId);
    streamId += 1;
    return Promise.resolve(decoder);
  }

  // node_modules/@yume-chan/scrcpy-decoder-tinyh264/esm/decoder.js
  var noop2 = () => {
  };
  function createCanvas() {
    if (typeof document !== "undefined") {
      return document.createElement("canvas");
    }
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(1, 1);
    }
    throw new Error("no canvas input found nor any canvas can be created");
  }
  var TinyH264Decoder = class {
    static capabilities = {
      h264: {
        maxProfile: AndroidAvcProfile.Baseline,
        maxLevel: AndroidAvcLevel.Level4
      }
    };
    #renderer;
    get renderer() {
      return this.#renderer;
    }
    #sizeChanged = new StickyEventEmitter();
    get sizeChanged() {
      return this.#sizeChanged.event;
    }
    #width = 0;
    get width() {
      return this.#width;
    }
    #height = 0;
    get height() {
      return this.#height;
    }
    #frameRendered = 0;
    get framesRendered() {
      return this.#frameRendered;
    }
    #frameSkipped = 0;
    get framesSkipped() {
      return this.#frameSkipped;
    }
    #writable;
    get writable() {
      return this.#writable;
    }
    #yuvCanvas;
    #initializer;
    constructor({ canvas } = {}) {
      if (canvas) {
        this.#renderer = canvas;
      } else {
        this.#renderer = createCanvas();
      }
      this.#writable = new WritableStream({
        write: async (packet) => {
          switch (packet.type) {
            case "configuration":
              await this.#configure(packet.data);
              break;
            case "data": {
              if (!this.#initializer) {
                throw new Error("Decoder not configured");
              }
              const wrapper = await this.#initializer.promise;
              wrapper.feed(packet.data.slice().buffer);
              break;
            }
          }
        }
      });
    }
    async #configure(data) {
      this.dispose();
      this.#initializer = new PromiseResolver();
      if (!this.#yuvCanvas) {
        const canvas = createCanvas();
        const attributes = {
          // Disallow software rendering.
          // Other rendering methods are faster than software-based WebGL.
          failIfMajorPerformanceCaveat: true
        };
        const gl = canvas.getContext("webgl2", attributes) || canvas.getContext("webgl", attributes);
        this.#yuvCanvas = import_yuv_canvas.default.attach(this.#renderer, {
          webGL: !!gl
        });
      }
      const { encodedWidth, encodedHeight, croppedWidth, croppedHeight, cropLeft, cropTop } = h264ParseConfiguration(data);
      this.#width = croppedWidth;
      this.#height = croppedHeight;
      this.#sizeChanged.fire({
        width: croppedWidth,
        height: croppedHeight
      });
      const chromaWidth = encodedWidth / 2;
      const chromaHeight = encodedHeight / 2;
      const format = import_yuv_buffer.default.format({
        width: encodedWidth,
        height: encodedHeight,
        chromaWidth,
        chromaHeight,
        cropLeft,
        cropTop,
        cropWidth: croppedWidth,
        cropHeight: croppedHeight,
        displayWidth: croppedWidth,
        displayHeight: croppedHeight
      });
      const wrapper = await createTinyH264Wrapper();
      this.#initializer.resolve(wrapper);
      const uPlaneOffset = encodedWidth * encodedHeight;
      const vPlaneOffset = uPlaneOffset + chromaWidth * chromaHeight;
      wrapper.onPictureReady(({ data: data2 }) => {
        this.#frameRendered += 1;
        const array = new Uint8Array(data2);
        const frame = import_yuv_buffer.default.frame(format, import_yuv_buffer.default.lumaPlane(format, array, encodedWidth, 0), import_yuv_buffer.default.chromaPlane(format, array, chromaWidth, uPlaneOffset), import_yuv_buffer.default.chromaPlane(format, array, chromaWidth, vPlaneOffset));
        this.#yuvCanvas.drawFrame(frame);
      });
      wrapper.feed(data.slice().buffer);
    }
    dispose() {
      this.#initializer?.promise.then((wrapper) => wrapper.dispose()).catch(noop2);
      this.#initializer = void 0;
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/render/canvas.js
  var CanvasVideoFrameRenderer = class {
    #canvas;
    get canvas() {
      return this.#canvas;
    }
    constructor(canvas) {
      if (canvas) {
        this.#canvas = canvas;
      } else {
        this.#canvas = createCanvas();
      }
    }
    setSize(width, height) {
      if (this.#canvas.width !== width || this.#canvas.height !== height) {
        this.#canvas.width = width;
        this.#canvas.height = height;
      }
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/render/bitmap.js
  var BitmapVideoFrameRenderer = class extends CanvasVideoFrameRenderer {
    #context;
    constructor(canvas) {
      super(canvas);
      this.#context = this.canvas.getContext("bitmaprenderer", {
        alpha: false
      });
    }
    async draw(frame) {
      const bitmap = await createImageBitmap(frame);
      this.#context.transferFromImageBitmap(bitmap);
    }
  };

  // node_modules/@yume-chan/scrcpy-decoder-webcodecs/esm/video/render/webgl.js
  var Resolved = Promise.resolve();
  function createContext(canvas, enableCapture) {
    const attributes = {
      // Low-power GPU should be enough for video rendering.
      powerPreference: "low-power",
      alpha: false,
      // Disallow software rendering.
      // Other rendering methods are faster than software-based WebGL.
      failIfMajorPerformanceCaveat: true,
      preserveDrawingBuffer: !!enableCapture
    };
    return canvas.getContext("webgl2", attributes) || canvas.getContext("webgl", attributes);
  }
  var WebGLVideoFrameRenderer = class _WebGLVideoFrameRenderer extends CanvasVideoFrameRenderer {
    static vertexShaderSource = `
        attribute vec2 xy;

        varying highp vec2 uv;

        void main(void) {
            gl_Position = vec4(xy, 0.0, 1.0);
            // Map vertex coordinates (-1 to +1) to UV coordinates (0 to 1).
            // UV coordinates are Y-flipped relative to vertex coordinates.
            uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
        }
`;
    static fragmentShaderSource = `
        varying highp vec2 uv;

        uniform sampler2D texture;

        void main(void) {
            gl_FragColor = texture2D(texture, uv);
        }
`;
    static get isSupported() {
      const canvas = createCanvas();
      return !!createContext(canvas);
    }
    #context;
    /**
     * Create a new WebGL frame renderer.
     * @param canvas The canvas to render frames to.
     * @param enableCapture
     * Whether to allow capturing the canvas content using APIs like `readPixels` and `toDataURL`.
     * Enable this option may reduce performance.
     */
    constructor(canvas, enableCapture) {
      super(canvas);
      const gl = createContext(this.canvas, enableCapture);
      if (!gl) {
        throw new Error("WebGL not supported");
      }
      this.#context = gl;
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, _WebGLVideoFrameRenderer.vertexShaderSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(vertexShader));
      }
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, _WebGLVideoFrameRenderer.fragmentShaderSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(fragmentShader));
      }
      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);
      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(shaderProgram));
      }
      gl.useProgram(shaderProgram);
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      const xyLocation = gl.getAttribLocation(shaderProgram, "xy");
      gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(xyLocation);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    draw(frame) {
      const gl = this.#context;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      return Resolved;
    }
  };

  // src/control.js
  var FINGER = PointerId.Finger;
  var MAX_TOUCH = 10;
  var DeviceController = class {
    /**
     * @param {import("@yume-chan/adb-scrcpy").AdbScrcpyClient} client
     * @param {{ width: () => number, height: () => number }} sizeSource
     */
    constructor(client, sizeSource, adb, hooks = {}) {
      this.client = client;
      this.adb = adb;
      this.sizeSource = sizeSource;
      this.active = /* @__PURE__ */ new Map();
      this._textBuf = "";
      this._textTimer = null;
      this._clipWaiters = [];
      this._clipDrained = false;
      this.onError = typeof hooks.onError === "function" ? hooks.onError : () => {
      };
    }
    _report(err, where) {
      try {
        this.onError(err, where);
      } catch {
      }
    }
    /** 控制通道是否还可用（client/controller 已被清理时为 false） */
    get alive() {
      return !!this.controller;
    }
    /**
     * 写入控制指令并加超时竞速：
     * 无线拥塞 / 连接半开时 writer.write 可能永久 pending，
     * 不超时会把后续所有触控排在同一个挂起 Promise 后面，表现为「点不动」。
     */
    async _write(fn, where) {
      const c = this.controller;
      if (!c) throw new Error("\u63A7\u5236\u901A\u9053\u672A\u8FDE\u63A5");
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("\u63A7\u5236\u6307\u4EE4\u53D1\u9001\u8D85\u65F6")), 2e3);
      });
      try {
        await Promise.race([fn(c), timeout]);
      } finally {
        clearTimeout(timer);
      }
    }
    /** 持续排空设备→电脑剪贴板流,记录最新值并唤醒等待者 */
    _ensureClipboardDrain() {
      if (this._clipDrained) return;
      const clip = this.client?.clipboard;
      if (!clip) return;
      this._clipDrained = true;
      (async () => {
        const reader = clip.getReader();
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          if (typeof value !== "string") continue;
          const waiters = this._clipWaiters.splice(0);
          for (const w of waiters) w(value);
        }
      })().catch(() => {
      });
    }
    /** 主动读取手机剪贴板(GET_CLIPBOARD),返回文本;超时返回 null */
    async getDeviceClipboard(timeoutMs = 1500) {
      const c = this.client?.controller;
      if (!c) throw new Error("ADB \u672A\u8FDE\u63A5");
      this._ensureClipboardDrain();
      if (!this.client?.clipboard) throw new Error("\u526A\u8D34\u677F\u6D41\u4E0D\u53EF\u7528");
      const wait = new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        this._clipWaiters.push((v) => {
          clearTimeout(timer);
          resolve(v);
        });
      });
      await c.write(new Uint8Array([8]));
      return await wait;
    }
    get controller() {
      return this.client?.controller ?? null;
    }
    _dims() {
      const w = this.sizeSource?.width?.() || 0;
      const h = this.sizeSource?.height?.() || 0;
      return { w, h };
    }
    /** 画布坐标 → 设备像素坐标 */
    toDevice(clientX, clientY, el) {
      const { w, h } = this._dims();
      if (!w || !h) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      const videoRatio = w / h;
      const boxRatio = rect.width / rect.height;
      let drawW = rect.width;
      let drawH = rect.height;
      let drawLeft = rect.left;
      let drawTop = rect.top;
      if (boxRatio > videoRatio) {
        drawW = rect.height * videoRatio;
        drawLeft = rect.left + (rect.width - drawW) / 2;
      } else if (boxRatio < videoRatio) {
        drawH = rect.width / videoRatio;
        drawTop = rect.top + (rect.height - drawH) / 2;
      }
      let nx = (clientX - drawLeft) / drawW;
      let ny = (clientY - drawTop) / drawH;
      nx = Math.min(1, Math.max(0, nx));
      ny = Math.min(1, Math.max(0, ny));
      const rot = Number(el.dataset.rotate || 0);
      if (rot === 90) {
        const t0 = nx;
        nx = 1 - ny;
        ny = t0;
      } else if (rot === 180) {
        nx = 1 - nx;
        ny = 1 - ny;
      } else if (rot === 270) {
        const t0 = nx;
        nx = ny;
        ny = 1 - t0;
      }
      return { x: nx * w, y: ny * h };
    }
    async touch(action, pointerId, x, y, pressure = 1, buttons = AndroidMotionEventButton.Primary) {
      const { w, h } = this._dims();
      await this._write(
        (c) => c.injectTouch({
          action,
          pointerId: BigInt(pointerId) & 0xffffffffffffffffn,
          pointerX: x,
          pointerY: y,
          videoWidth: w,
          videoHeight: h,
          pressure,
          buttons
        }),
        "touch"
      );
    }
    async pointerDown(pointerId, x, y) {
      const stale = this.active.get(pointerId);
      if (stale) {
        this.active.delete(pointerId);
        try {
          await this.touch(AndroidMotionEventAction.Cancel, pointerId, stale.x, stale.y, 0);
        } catch (e) {
          this._report(e, "pointerDown-cancel-stale");
        }
      }
      if (this.active.size >= MAX_TOUCH) return;
      this.active.set(pointerId, { x, y, downAt: Date.now() });
      try {
        await this.touch(AndroidMotionEventAction.Down, pointerId, x, y);
      } catch (e) {
        this.active.delete(pointerId);
        this._report(e, "pointerDown");
      }
    }
    async pointerMove(pointerId, x, y) {
      const last = this.active.get(pointerId);
      if (!last) return;
      this.active.set(pointerId, { x, y, downAt: last.downAt });
      try {
        await this.touch(AndroidMotionEventAction.Move, pointerId, x, y);
      } catch (e) {
        this._report(e, "pointerMove");
      }
    }
    async pointerUp(pointerId) {
      const last = this.active.get(pointerId);
      if (!last) return;
      this.active.delete(pointerId);
      try {
        await this.touch(AndroidMotionEventAction.Up, pointerId, last.x, last.y, 0);
      } catch (e) {
        this._report(e, "pointerUp");
      }
    }
    async pointerCancel(pointerId) {
      const last = this.active.get(pointerId);
      if (!last) return;
      this.active.delete(pointerId);
      try {
        await this.touch(AndroidMotionEventAction.Cancel, pointerId, last.x, last.y, 0);
      } catch (e) {
        this._report(e, "pointerCancel");
      }
    }
    /** 释放所有残留按压（窗口失焦 / 断线 / 重新绑定前调用） */
    async releaseAllPointers() {
      for (const id of [...this.active.keys()]) {
        await this.pointerCancel(id).catch(() => {
        });
      }
      this.active.clear();
    }
    async scroll(x, y, dx, dy) {
      const { w, h } = this._dims();
      try {
        await this._write(
          (c) => c.injectScroll({
            pointerX: x,
            pointerY: y,
            videoWidth: w,
            videoHeight: h,
            scrollX: dx,
            scrollY: dy,
            buttons: 0
          })
        );
      } catch (e) {
        this._report(e, "scroll");
      }
    }
    async key(action, keyCode, metaState = 0) {
      try {
        await this._write(
          (c) => c.injectKeyCode({ action, keyCode, metaState, repeat: 0 })
        );
      } catch (e) {
        this._report(e, "key");
      }
    }
    async tapKey(keyCode, metaState = 0) {
      await this.key(AndroidKeyEventAction.Down, keyCode, metaState);
      await this.key(AndroidKeyEventAction.Up, keyCode, metaState);
    }
    /** DOM KeyboardEvent.code → AndroidKeyCode */
    /**
     * Keyboard / CJK input:
     * - printable (incl. Chinese) -> injectText
     * - function keys -> injectKeyCode
     */
    async keyFromEvent(e, isDown) {
      const key = e.key || "";
      const code = e.code || "";
      if (e.isComposing || key === "Process" || key === "Unidentified") {
        return;
      }
      const isPrintable = key.length === 1 || key.length > 1 && !/^(Enter|Backspace|Tab|Escape|Delete|Arrow\w+|Home|End|Page\w+|F\d+|Control|Shift|Alt|Meta|CapsLock|ContextMenu|Dead)$/.test(key);
      if (isPrintable) {
        if (isDown) await this.injectText(key);
        return;
      }
      let keyCode = AndroidKeyCode[code];
      if (keyCode == null) {
        const map = {
          Enter: AndroidKeyCode.Enter,
          Backspace: AndroidKeyCode.Backspace,
          Tab: AndroidKeyCode.Tab,
          Space: AndroidKeyCode.Space,
          Escape: AndroidKeyCode.Escape,
          Delete: AndroidKeyCode.Delete
        };
        keyCode = map[code] ?? map[key];
      }
      if (keyCode == null) return;
      let meta = 0;
      if (e.altKey) meta |= 2 | 16;
      if (e.shiftKey) meta |= 1 | 64;
      if (e.ctrlKey) meta |= 4096 | 8192;
      if (e.metaKey) meta |= 65536 | 131072;
      await this.key(
        isDown ? AndroidKeyEventAction.Down : AndroidKeyEventAction.Up,
        keyCode,
        meta
      );
    }
    async injectComposition(text) {
      if (!text) return;
      await this.injectText(text);
    }
    async injectText(text) {
      const c = this.controller;
      const s = text == null ? "" : String(text);
      if (!c || !s) return;
      try {
        await c.injectText(s);
      } catch (e) {
        await this.setClipboardAndPaste(s);
      }
    }
    /** 缓冲短按键，批量注入文本（中文/粘贴） */
    queueText(chunk) {
      this._textBuf += chunk;
      if (this._textTimer) clearTimeout(this._textTimer);
      this._textTimer = setTimeout(async () => {
        const t = this._textBuf;
        this._textBuf = "";
        if (t) await this.injectText(t).catch(() => {
        });
      }, 30);
    }
    async back() {
      await this.tapKey(AndroidKeyCode.AndroidBack);
    }
    async home() {
      await this.tapKey(AndroidKeyCode.AndroidHome);
    }
    async recents() {
      await this.tapKey(AndroidKeyCode.AndroidAppSwitch);
    }
    async power() {
      await this.tapKey(AndroidKeyCode.Power);
    }
    async volumeUp() {
      await this.tapKey(AndroidKeyCode.VolumeUp);
    }
    async volumeDown() {
      await this.tapKey(AndroidKeyCode.VolumeDown);
    }
    async menu() {
      await this.tapKey(AndroidKeyCode.ContextMenu);
    }
    async search() {
      await this.tapKey(AndroidKeyCode.AndroidSearch);
    }
    async expandNotifications() {
      await this.controller?.expandNotificationPanel();
    }
    async expandSettings() {
      await this.controller?.expandSettingPanel();
    }
    async collapseNotifications() {
      await this.controller?.collapseNotificationPanel();
    }
    async rotate() {
      await this.controller?.rotateDevice();
    }
    async screenOn() {
      await this.controller?.setScreenPowerMode(AndroidScreenPowerMode.Normal);
    }
    async screenOff() {
      await this.controller?.setScreenPowerMode(AndroidScreenPowerMode.Off);
    }
    async setClipboard(text) {
      const c = this.controller;
      const content = text == null ? "" : String(text);
      if (!c) return;
      await c.setClipboard({ content, sequence: 0n, paste: false });
    }
    async setClipboardAndPaste(text) {
      const c = this.controller;
      const content = text == null ? "" : String(text);
      if (!c) return;
      await c.setClipboard({ content, sequence: 0n, paste: true });
    }
    async backspace() {
      await this.tapKey(AndroidKeyCode.Backspace);
    }
    async deleteKey() {
      await this.tapKey(AndroidKeyCode.Delete);
    }
    async enter() {
      await this.tapKey(AndroidKeyCode.Enter);
    }
    async tab() {
      await this.tapKey(AndroidKeyCode.Tab);
    }
    async escape() {
      await this.tapKey(AndroidKeyCode.Escape);
    }
    async pageUp() {
      await this.tapKey(AndroidKeyCode.PageUp);
    }
    async pageDown() {
      await this.tapKey(AndroidKeyCode.PageDown);
    }
    /** 关屏（继续镜像） */
    async screenOffKeepMirror() {
      await this.screenOff();
    }
    /** 亮屏 */
    async wakeUp() {
      await this.screenOn();
    }
    /** 手机快捷键截屏 → 拉到电脑「图片」目录 */
    /** 手机截屏 → 保存到电脑「图片」 */
    /** 手机快捷键截屏 → 拉取同一张图到电脑「图片」 */
    /** 手机快捷键截屏 → 拉取同一张到电脑「图片」 */
    /** 截取当前画面并保存到电脑「图片」 */
    /** 手机相册截屏 + 保存到电脑「图片」，返回路径/缩略图 */
    async phoneScreenshot() {
      const adb = this.adb;
      if (!adb?.subprocess?.noneProtocol) {
        throw new Error("ADB \u672A\u8FDE\u63A5");
      }
      const run = (argv) => adb.subprocess.noneProtocol.spawnWaitText(argv).then((s) => (s || "").trim());
      try {
        await run(["input", "keyevent", "120"]);
      } catch {
      }
      try {
        await run(["input", "keyevent", "KEYCODE_SYSRQ"]);
      } catch {
      }
      await new Promise((r) => setTimeout(r, 700));
      const fixed = "/sdcard/scrcpy-web-shot.png";
      try {
        await run(["screencap", "-p", fixed]);
      } catch {
      }
      try {
        await run([
          "am",
          "broadcast",
          "-a",
          "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
          "-d",
          "file://" + fixed
        ]);
      } catch {
      }
      await new Promise((r) => setTimeout(r, 200));
      let remote = "";
      const dirs = [
        "/sdcard/Pictures/Screenshots",
        "/sdcard/DCIM/Screenshots",
        "/sdcard/Pictures"
      ];
      for (const dir of dirs) {
        try {
          const name = await run([
            "sh",
            "-c",
            "ls -1t " + dir + " 2>/dev/null | grep -E '\\.(png|jpg)$' | head -1"
          ]);
          const n = (name || "").split("\n").map((s) => s.trim()).filter(Boolean).pop();
          const full = n ? dir + "/" + n : "";
          if (full.startsWith("/sdcard/") && /\.(png|jpg|jpeg)$/i.test(full)) {
            remote = full;
            break;
          }
        } catch {
        }
      }
      if (!remote) remote = fixed;
      const sync = await adb.sync();
      let bytes;
      try {
        const stream = sync.read(remote);
        const chunks = [];
        const reader = stream.getReader();
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        let total = 0;
        for (const c of chunks) total += c.length;
        bytes = new Uint8Array(total);
        let o = 0;
        for (const c of chunks) {
          bytes.set(c, o);
          o += c.length;
        }
      } finally {
        try {
          await sync.dispose();
        } catch {
        }
      }
      if (!bytes || bytes.length < 200) {
        throw new Error("\u622A\u56FE\u6570\u636E\u4E3A\u7A7A");
      }
      let bin = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      }
      const resp = await fetch("/api/save-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "scrcpy-shot-" + Date.now() + ".png",
          data: btoa(bin),
          remote
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "\u4FDD\u5B58\u5230\u7535\u8111\u5931\u8D25");
      }
      return {
        path: data.path,
        name: data.name,
        thumb: data.thumb || "",
        remote
      };
    }
    async dispose() {
      await this.releaseAllPointers();
      if (this._textTimer) clearTimeout(this._textTimer);
    }
  };

  // src/pcm-worklet.js
  var PCM_PROCESSOR_NAME = "pcm-sink";
  var PCM_WORKLET_SOURCE = `
class PcmSink extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opt = (options && options.processorOptions) || {};
    this.rate = opt.sampleRate || 48000;
    this.ch = opt.channels || 2;
    this.primeMs = opt.primeMs || 45;
    this.maxMs = opt.maxMs || 150;
    this.targetMs = opt.targetMs || 40;
    this.bufs = [];
    this.head = 0;
    this.len = 0;          // \u5F85\u64AD\u91C7\u6837\u70B9\uFF08\u4EA4\u7EC7\uFF0C\u542B\u6240\u6709\u58F0\u9053\uFF09
    this.primed = false;
    this.trimmedMs = 0;    // \u672C\u8F6E\u4E0A\u62A5\u5468\u671F\u5185\u88AB\u524A\u6389\u7684\u65F6\u957F
    this.underruns = 0;
    this.playedFrames = 0;
    this.blocks = 0;
    this.peakMs = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "pcm" && d.samples) {
        this.bufs.push(d.samples);
        this.len += d.samples.length;
        this._trim();
      } else if (d.type === "reset") {
        this.bufs = [];
        this.head = 0;
        this.len = 0;
        this.primed = false;
      }
    };
  }
  _bufferedFrames() { return this.len / this.ch;
  }
  _trim() {
    const maxLen = Math.floor((this.rate * this.maxMs) / 1000) * this.ch;
    if (this.len <= maxLen) return;
    const targetLen = Math.floor((this.rate * this.targetMs) / 1000) * this.ch;
    while (this.len > targetLen && this.bufs.length) {
      const b = this.bufs[0];
      const drop = Math.min(b.length - this.head, this.len - targetLen);
      this.head += drop;
      this.len -= drop;
      this.trimmedMs += drop / this.ch / this.rate * 1000;
      if (this.head >= b.length) { this.bufs.shift(); this.head = 0; }
    }
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const frames = out[0] ? out[0].length : 128;
    let i = 0;
    // \u8D77\u64AD/\u65AD\u7CAE\u540E\u5148\u6512\u591F primeMs \u518D\u51FA\u58F0\uFF0C\u907F\u514D\u6BCF\u4E2A\u5305\u8FB9\u754C\u90FD\u63D2\u4E00\u6BB5\u9759\u97F3
    if (!this.primed) {
      if (this._bufferedFrames() * 1000 / this.rate >= this.primeMs) this.primed = true;
    }
    if (this.primed) {
      while (i < frames && this.len >= this.ch) {
        const b = this.bufs[0];
        for (let c = 0; c < out.length; c++) out[c][i] = b[this.head + Math.min(c, this.ch - 1)];
        this.head += this.ch;
        this.len -= this.ch;
        i += 1;
        if (this.head >= b.length) { this.bufs.shift(); this.head = 0; }
      }
      if (i < frames) {
        // \u65AD\u7CAE\uFF1A\u8865\u9759\u97F3\uFF0C\u6807\u8BB0\u6B20\u8F7D\uFF0C\u7B49\u4E0B\u6B21\u6512\u591F\u518D\u7EE7\u7EED
        for (let c = 0; c < out.length; c++) out[c].fill(0, i);
        this.underruns += 1;
        this.primed = false;
      } else if (this.len < this.ch) {
        // \u672C\u5757\u521A\u597D\u628A\u7F13\u51B2\u64AD\u7A7A\uFF1A\u540C\u6837\u8BB0\u4E3A\u4E00\u6B21\u6B20\u8F7D\uFF0C\u4E0B\u4E00\u5757\u8FDB\u5165\u91CD\u65B0\u84C4\u6C34
        this.underruns += 1;
        this.primed = false;
      }
    } else {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
    }
    const buffered = this._bufferedFrames();
    if (buffered * 1000 / this.rate > this.peakMs) this.peakMs = buffered * 1000 / this.rate;
    this.playedFrames += frames;
    this.blocks += 1;
    // \u6BCF\u7EA6 0.5 \u79D2\u4E0A\u62A5\u4E00\u6B21\u72B6\u6001\uFF08128 \u5E27/\u5757 \u2248 2.67ms\uFF09
    if (this.blocks % 188 === 0) {
      this.port.postMessage({
        type: "status",
        bufferedMs: Math.round((buffered * 1000) / this.rate),
        peakMs: Math.round(this.peakMs),
        trimmedMs: Math.round(this.trimmedMs),
        underruns: this.underruns,
        playedSec: this.playedFrames / this.rate,
      });
      this.trimmedMs = 0;
      this.peakMs = 0;
    }
    return true;
  }
}
registerProcessor("${PCM_PROCESSOR_NAME}", PcmSink);
`;
  var _moduleUrl = null;
  function pcmWorkletUrl() {
    if (!_moduleUrl) {
      _moduleUrl = URL.createObjectURL(new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" }));
    }
    return _moduleUrl;
  }

  // src/audio.js
  var AudioMirror = class {
    constructor() {
      this.ctx = null;
      this.gain = null;
      this.decoder = null;
      this.playing = false;
      this.muted = false;
      this._nextTime = 0;
      this._codec = "";
      this._rate = 48e3;
      this._ch = 2;
      this._packets = 0;
      this._framesOut = 0;
      this._lastErr = "";
      this._rms = 0;
      this._sources = /* @__PURE__ */ new Set();
      this._dropped = 0;
      this._resync = 0;
      this._syncMsg = "";
      this.onLog = null;
      this.sink = null;
      this._bufferedMs = 0;
      this._underruns = 0;
      this._trimmedTotal = 0;
      this._lastTrimLog = 0;
    }
    get stats() {
      return {
        codec: this._codec || "\u2014",
        packets: this._packets,
        frames: this._framesOut,
        playing: this.playing,
        muted: this.muted,
        rms: this._rms || 0,
        dropped: this._dropped || 0,
        resync: this._resync || 0,
        bufferedMs: this.sink ? this._bufferedMs : null,
        underruns: this._underruns || 0,
        latencyMs: this.latencyMs,
        err: this._lastErr || "\u2014"
      };
    }
    /** 当前音频缓冲延迟（毫秒）：待播缓冲 + 声卡输出延迟 */
    get latencyMs() {
      if (!this.ctx || !this.playing) return null;
      try {
        const out = (this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1e3;
        if (this.sink) return Math.round((this._bufferedMs || 0) + out);
        const ahead = Math.max(0, this._nextTime - this.ctx.currentTime) * 1e3;
        return Math.round(ahead + out);
      } catch {
        return null;
      }
    }
    async ensureContext() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error("AudioContext \u4E0D\u53EF\u7528");
        this.ctx = new AC({ latencyHint: "interactive", sampleRate: 48e3 });
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 1;
        this.gain.connect(this.ctx.destination);
        this._nextTime = 0;
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return this.ctx;
    }
    async start(meta) {
      await this.ensureContext();
      if (!meta) {
        this._lastErr = "\u65E0\u97F3\u9891\u5143\u6570\u636E";
        return { ok: false, reason: this._lastErr };
      }
      if (meta.type === "disabled") {
        this._lastErr = "\u8BBE\u5907\u672A\u5F00\u542F\u97F3\u9891\u8F6C\u53D1";
        return { ok: false, reason: this._lastErr };
      }
      if (meta.type === "errored") {
        this._lastErr = "\u8BBE\u5907\u97F3\u9891\u9519\u8BEF";
        return { ok: false, reason: this._lastErr };
      }
      if (!meta.stream) {
        this._lastErr = "\u65E0\u97F3\u9891\u6D41";
        return { ok: false, reason: this._lastErr };
      }
      const optionValue = String(meta.codec?.optionValue || "").toLowerCase();
      const webId = String(meta.codec?.webCodecId || "").toLowerCase();
      const mime = String(meta.codec?.mimeType || "").toLowerCase();
      this._codec = optionValue || webId || mime || "audio";
      if (optionValue === "raw" || mime.includes("raw") || mime.includes("pcm")) {
        this._codec = "raw-pcm";
        this._startPcmLoop(meta.stream);
        this.playing = true;
        return { ok: true, mode: "pcm", codec: this._codec };
      }
      if (typeof AudioDecoder === "undefined") {
        this._lastErr = "\u65E0 AudioDecoder\uFF0C\u8BF7\u7528 Chrome/Edge";
        return { ok: false, reason: this._lastErr };
      }
      const isAac = /aac|mp4a/.test(this._codec + mime);
      const rate = 48e3;
      const ch = 2;
      this._rate = rate;
      this._ch = ch;
      const codecCandidates = isAac ? ["mp4a.40.2", "aac"] : ["opus", webId || "opus"];
      let config = null;
      for (const codec of codecCandidates) {
        try {
          const cfg = { codec, sampleRate: rate, numberOfChannels: ch };
          const s = await AudioDecoder.isConfigSupported(cfg);
          if (s?.supported) {
            config = cfg;
            break;
          }
        } catch {
        }
      }
      if (!config) {
        config = { codec: codecCandidates[0], sampleRate: rate, numberOfChannels: ch };
      }
      try {
        this.decoder = new AudioDecoder({
          output: (data) => this._playAudioData(data),
          error: (e) => {
            this._lastErr = String(e?.message || e);
            console.warn("[audio] decoder", e);
          }
        });
        this.decoder.configure(config);
      } catch (e) {
        this._lastErr = String(e?.message || e);
        return { ok: false, reason: this._lastErr };
      }
      this.playing = true;
      this._nextTime = 0;
      (async () => {
        const reader = meta.stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.data) continue;
          this._packets += 1;
          if (this.muted) continue;
          try {
            if (value.type === "configuration" && value.data && !this._gotConfig) {
              this._gotConfig = true;
              try {
                this.decoder.configure({
                  codec: config.codec,
                  sampleRate: rate,
                  numberOfChannels: ch,
                  description: value.data
                });
              } catch (e) {
              }
              continue;
            }
            if (this.decoder.state === "closed") break;
            this.decoder.decode(
              new EncodedAudioChunk({
                type: "key",
                timestamp: this._packets * 2e4,
                data: value.data
              })
            );
          } catch (e) {
            this._lastErr = String(e?.message || e);
          }
        }
      })().catch((e) => {
        this._lastErr = String(e?.message || e);
      });
      return { ok: true, mode: "webcodecs:" + config.codec, codec: config.codec };
    }
    /**
     * 剥掉 scrcpy 5.x 逐包 12 字节帧头（pts u64 BE + len u32 BE）。
     * 只在该包里「len 恰好等于 总长-12」时剥离，误判概率约 1/2^32，不会破坏正常 PCM。
     */
    _stripPacketHeader(bytes) {
      if (bytes.byteLength < 16) return bytes;
      try {
        const len = new DataView(bytes.buffer, bytes.byteOffset, 12).getUint32(8, false);
        if (len > 0 && len === bytes.byteLength - 12) return bytes.subarray(12);
      } catch {
      }
      return bytes;
    }
    _startPcmLoop(stream) {
      if (this.ctx?.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        this._startPcmWorklet(stream).catch((e) => {
          this._lastErr = String(e?.message || e);
          console.warn("[audio] worklet \u542F\u52A8\u5931\u8D25\uFF0C\u9000\u56DE\u6392\u7A0B\u64AD\u653E", e);
          try {
            this.sink?.disconnect();
          } catch {
          }
          this.sink = null;
          this._startPcmLoopLegacy(stream);
        });
        return;
      }
      this._startPcmLoopLegacy(stream);
    }
    /** 硬件时钟播放：主线程只管灌 PCM，取走由 worklet 按真实采样率完成 */
    async _startPcmWorklet(stream) {
      await this.ctx.audioWorklet.addModule(pcmWorkletUrl());
      const node = new AudioWorkletNode(this.ctx, PCM_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          sampleRate: this._rate,
          channels: 2,
          primeMs: 45,
          // 起播先攒 45ms，避免每个包边界插静音
          maxMs: 150,
          // 超过 150ms 才削，正常抖动根本碰不到
          targetMs: 40
        }
      });
      this.sink = node;
      node.connect(this.gain);
      node.port.onmessage = (e) => {
        const d = e.data || {};
        if (d.type !== "status") return;
        this._bufferedMs = d.bufferedMs || 0;
        this._underruns = d.underruns || 0;
        if (d.trimmedMs >= 15) {
          this._dropped += 1;
          this._trimmedTotal += d.trimmedMs;
          const now = Date.now();
          if (now - this._lastTrimLog > 1e4) {
            this._lastTrimLog = now;
            try {
              this.onLog?.(`\u58F0\u97F3\u7F13\u51B2\u524A\u51CF ${Math.round(d.trimmedMs)}ms\uFF08\u79EF\u538B\u8D85\u8FC7 150ms\uFF0C\u5DF2\u524A\u56DE 40ms\uFF09`);
            } catch {
            }
          }
        }
      };
      (async () => {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.data) continue;
          this._packets += 1;
          if (this.muted) continue;
          const bytes = this._stripPacketHeader(value.data);
          const pairs = bytes.byteLength >> 2;
          if (pairs < 1) continue;
          const f32 = new Float32Array(pairs * 2);
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          let sum = 0;
          for (let i = 0; i < pairs * 2; i += 1) {
            const s = view.getInt16(i * 2, true) / 32768;
            f32[i] = s;
            sum += s * s;
          }
          this._framesOut += pairs;
          this._rms = Math.sqrt(sum / (pairs * 2));
          node.port.postMessage({ type: "pcm", samples: f32 }, [f32.buffer]);
        }
      })().catch((e) => {
        this._lastErr = String(e?.message || e);
      });
    }
    _startPcmLoopLegacy(stream) {
      (async () => {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.data) continue;
          this._packets += 1;
          if (this.muted) continue;
          const bytes = value.data;
          const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
          const frames = samples.length >> 1;
          if (frames < 1) continue;
          const buffer2 = this.ctx.createBuffer(2, frames, this._rate);
          const L = buffer2.getChannelData(0);
          const R = buffer2.getChannelData(1);
          for (let i = 0; i < frames; i++) {
            L[i] = samples[i * 2] / 32768;
            R[i] = samples[i * 2 + 1] / 32768;
          }
          this._framesOut += frames;
          this._schedule(buffer2);
        }
      })().catch((e) => {
        this._lastErr = String(e?.message || e);
      });
    }
    _playAudioData(audioData) {
      try {
        const frames = audioData.numberOfFrames;
        const ch = audioData.numberOfChannels || 2;
        const rate = audioData.sampleRate || 48e3;
        if (frames <= 0) {
          audioData.close();
          return;
        }
        this._rate = rate;
        this._ch = ch;
        this._framesOut += frames;
        const buffer2 = this.ctx.createBuffer(ch, frames, rate);
        let ok = false;
        for (let c = 0; c < ch; c++) {
          const plane = new Float32Array(frames);
          try {
            audioData.copyTo(plane, { planeIndex: c, format: "f32" });
            buffer2.getChannelData(c).set(plane);
            ok = true;
          } catch {
            ok = false;
            break;
          }
        }
        if (!ok) {
          const all2 = new Float32Array(frames * ch);
          audioData.copyTo(all2, { format: "f32" });
          for (let c = 0; c < ch; c++) {
            const out = buffer2.getChannelData(c);
            for (let i = 0; i < frames; i++) out[i] = all2[i * ch + c];
          }
        }
        audioData.close();
        try {
          let sum = 0, n = 0;
          for (let c = 0; c < buffer2.numberOfChannels; c++) {
            const d = buffer2.getChannelData(c);
            for (let i = 0; i < d.length; i += 8) {
              sum += d[i] * d[i];
              n++;
            }
          }
          this._rms = n ? Math.sqrt(sum / n) : 0;
        } catch (e) {
        }
        this._schedule(buffer2);
      } catch (e) {
        this._lastErr = String(e?.message || e);
        try {
          audioData.close();
        } catch {
        }
      }
    }
    /**
     * 把还没播/正在播的旧音源全部停掉。
     * 网络抖动后必须这么干：只重置 _nextTime 而不停旧源的话，
     * 旧 buffer 和新 buffer 会叠在一起放，听起来就是「加速 + 叠音 + 卡顿」。
     */
    _flushSources() {
      if (!this._sources) return;
      for (const s of this._sources) {
        try {
          s.onended = null;
          s.stop();
        } catch {
        }
        try {
          s.disconnect();
        } catch {
        }
      }
      this._sources.clear();
    }
    _schedule(buffer2) {
      if (!this.ctx || this.muted) return;
      try {
        const now = this.ctx.currentTime;
        const targetAhead = 0.04;
        const maxAhead = 0.12;
        const aheadMs = (this._nextTime - now) * 1e3;
        if (!this._nextTime || this._nextTime < now - 0.02 || aheadMs > maxAhead * 1e3) {
          this._flushSources();
          this._nextTime = now + targetAhead;
          if (aheadMs > 80) {
            this._resync += 1;
            this._syncMsg = "\u58F0\u97F3\u91CD\u540C\u6B65\uFF1A\u79EF\u538B " + Math.round(aheadMs) + "ms \u2192 \u538B\u7F29\u5230 " + Math.round(targetAhead * 1e3) + "ms\uFF08\u7B2C " + this._resync + " \u6B21\uFF09";
            try {
              this.onLog?.(this._syncMsg);
            } catch {
            }
          }
          this._dropped += 1;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer2;
        src.connect(this.gain);
        src.onended = () => {
          this._sources.delete(src);
          try {
            src.disconnect();
          } catch {
          }
        };
        this._sources.add(src);
        src.start(this._nextTime);
        this._nextTime += buffer2.duration;
      } catch (e) {
        this._lastErr = String(e?.message || e);
      }
    }
    setMuted(muted) {
      this.muted = !!muted;
      if (this.gain) this.gain.gain.value = this.muted ? 0 : 1;
      return this.muted;
    }
    async stop() {
      this.playing = false;
      try {
        this.sink?.port.postMessage({ type: "reset" });
        this.sink?.disconnect();
      } catch {
      }
      this.sink = null;
      this._flushSources();
      this._nextTime = 0;
      try {
        if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
      } catch {
      }
      this.decoder = null;
      try {
        await this.ctx?.close();
      } catch {
      }
      this.ctx = null;
      this.gain = null;
    }
  };

  // src/audio-v5.js
  var V5_AUDIO_HEADER_BYTES = 12;
  function classifyV5AudioHead(bytes) {
    if (bytes && bytes.byteLength >= V5_AUDIO_HEADER_BYTES) return { type: "data" };
    if (bytes && bytes.byteLength >= 4) {
      const sig = bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];
      return { type: sig === 0 ? "disabled" : "errored" };
    }
    return { type: "errored" };
  }
  function createV5AudioMetaParser(codec, makeStream) {
    return async (stream) => {
      const reader = stream.getReader();
      let buf = new Uint8Array(0);
      const append = (value) => {
        const merged = new Uint8Array(buf.byteLength + value.byteLength);
        merged.set(buf);
        merged.set(value, buf.byteLength);
        buf = merged;
      };
      try {
        while (buf.byteLength < V5_AUDIO_HEADER_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          append(value);
        }
        const verdict = classifyV5AudioHead(buf);
        if (verdict.type === "data") {
          return { type: "success", codec, stream: makeStream(buf, reader) };
        }
        return { type: verdict.type };
      } catch {
        return { type: "errored" };
      }
    };
  }

  // src/log-i18n.js
  var SERVER_RULES = [
    [/^INFO: Device: \[([^\]]+)\]\s*(.+?)\s*\(Android\s*([^)]+)\)\s*$/, "\u8BBE\u5907 $2 \xB7 \u5382\u5546 $1 \xB7 \u5B89\u5353 $3"],
    [/^INFO: Device: \[([^\]]+)\]\s*(.+)$/, "\u8BBE\u5907 $2 \xB7 \u5382\u5546 $1"],
    [/^INFO: Device serial: (.+)$/, "\u8BBE\u5907\u5E8F\u5217\u53F7 $1"],
    [/^DEBUG: Using video encoder: '?([^']+)'?$/, "\u89C6\u9891\u7F16\u7801\u5668 $1"],
    [/^DEBUG: Using audio encoder: '?([^']+)'?$/, "\u97F3\u9891\u7F16\u7801\u5668 $1"],
    [/^DEBUG: Video codec size alignment requirement: (\d+)px$/, "\u89C6\u9891\u5C3A\u5BF8\u9700 $1 \u50CF\u7D20\u5BF9\u9F50"],
    [/^DEBUG: Display: using DisplayManager API$/, "\u663E\u793A\u63A5\u53E3 DisplayManager"],
    [/^INFO: Device display turned off$/, "\u624B\u673A\u5C4F\u5E55\u5DF2\u5173\u95ED"],
    [/^INFO: Device display turned on$/, "\u624B\u673A\u5C4F\u5E55\u5DF2\u70B9\u4EAE"],
    [/^INFO: Screen size: (\d+)x(\d+)$/, "\u5C4F\u5E55\u5C3A\u5BF8 $1\xD7$2"],
    [/^INFO: (?:Starting|Launching) server/, "\u670D\u52A1\u7AEF\u542F\u52A8"],
    [/^INFO: Audio (?:disabled|capture disabled).*$/, "\u97F3\u9891\u91C7\u96C6\u88AB\u7981\u7528"],
    [/^INFO: Audio source: (.+)$/, "\u97F3\u9891\u6765\u6E90 $1"],
    [/^DEBUG: Audio source: (.+)$/, "\u97F3\u9891\u6765\u6E90 $1"],
    [/^INFO: Video source: (.+)$/, "\u89C6\u9891\u6765\u6E90 $1"],
    [/^DEBUG: Video source: (.+)$/, "\u89C6\u9891\u6765\u6E90 $1"],
    [/^INFO: Recording started/, "\u5F00\u59CB\u5F55\u5236"],
    [/^INFO: Capture stopped/, "\u91C7\u96C6\u5DF2\u505C\u6B62"],
    [/^INFO: Video encoding stopped/, "\u89C6\u9891\u7F16\u7801\u5DF2\u505C\u6B62"],
    [/^INFO: Audio encoding stopped/, "\u97F3\u9891\u7F16\u7801\u5DF2\u505C\u6B62"],
    [/^INFO: Encoder stopped/, "\u7F16\u7801\u5668\u5DF2\u505C\u6B62"],
    [/^INFO: Controller stopped/, "\u63A7\u5236\u901A\u9053\u5DF2\u505C\u6B62"],
    [/^INFO: Server stopped/, "\u670D\u52A1\u7AEF\u5DF2\u505C\u6B62"],
    [/^ERROR: Could not open video encoder '?([^']+)'?/, "\u6253\u4E0D\u5F00\u89C6\u9891\u7F16\u7801\u5668 $1"],
    [/^ERROR: Could not open audio encoder '?([^']+)'?/, "\u6253\u4E0D\u5F00\u97F3\u9891\u7F16\u7801\u5668 $1"],
    [/^ERROR: No video encoder could be found/, "\u627E\u4E0D\u5230\u53EF\u7528\u7684\u89C6\u9891\u7F16\u7801\u5668"],
    [/^ERROR: Could not (?:start|create) audio (?:capture|recorder)/, "\u65E0\u6CD5\u542F\u52A8\u97F3\u9891\u91C7\u96C6"],
    [/^ERROR: Could not (?:start|create) video (?:capture|recorder)/, "\u65E0\u6CD5\u542F\u52A8\u89C6\u9891\u91C7\u96C6"],
    [/^ERROR: (.+)$/, "\u9519\u8BEF\uFF1A$1"],
    [/^WARN: (.+)$/, "\u8B66\u544A\uFF1A$1"],
    [/^INFO: (.+)$/, "\u4FE1\u606F\uFF1A$1"],
    [/^DEBUG: (.+)$/, "\u8C03\u8BD5\uFF1A$1"],
    [/^TRACE: (.+)$/, "\u8DDF\u8E2A\uFF1A$1"]
  ];
  var PHRASES = [
    [/\bDevice serial\b/g, "\u8BBE\u5907\u5E8F\u5217\u53F7"],
    [/\bDevice display turned off\b/g, "\u624B\u673A\u5C4F\u5E55\u5DF2\u5173\u95ED"],
    [/\bDevice display turned on\b/g, "\u624B\u673A\u5C4F\u5E55\u5DF2\u70B9\u4EAE"],
    [/\bUsing video encoder\b/g, "\u89C6\u9891\u7F16\u7801\u5668"],
    [/\bUsing audio encoder\b/g, "\u97F3\u9891\u7F16\u7801\u5668"],
    [/\bCould not open audio encoder\b/g, "\u6253\u4E0D\u5F00\u97F3\u9891\u7F16\u7801\u5668"],
    [/\bCould not open video encoder\b/g, "\u6253\u4E0D\u5F00\u89C6\u9891\u7F16\u7801\u5668"],
    [/\bNo video encoder could be found\b/g, "\u627E\u4E0D\u5230\u53EF\u7528\u7684\u89C6\u9891\u7F16\u7801\u5668"],
    [/\bCould not start audio capture\b/g, "\u65E0\u6CD5\u542F\u52A8\u97F3\u9891\u91C7\u96C6"],
    [/\bCould not start video capture\b/g, "\u65E0\u6CD5\u542F\u52A8\u89C6\u9891\u91C7\u96C6"],
    [/\bConnection refused\b/g, "\u8FDE\u63A5\u88AB\u62D2\u7EDD"],
    [/\bPermission denied\b/g, "\u6743\u9650\u4E0D\u8DB3"],
    [/\bNo such file or directory\b/g, "\u6587\u4EF6\u6216\u76EE\u5F55\u4E0D\u5B58\u5728"],
    [/\bnot found\b/g, "\u672A\u627E\u5230"],
    [/\btimeout\b/gi, "\u8D85\u65F6"],
    [/\bfailed\b/gi, "\u5931\u8D25"]
  ];
  function translateServerLine(text) {
    let line = String(text == null ? "" : text).trim();
    if (!line) return "";
    let isServer = false;
    if (line.startsWith("[server]")) {
      isServer = true;
      line = line.slice("[server]".length).trim();
    }
    for (const [re, tpl] of SERVER_RULES) {
      const m = line.match(re);
      if (m) {
        const out = tpl.replace(/\$(\d)/g, (_, i) => (m[Number(i)] || "").trim());
        return (isServer ? "\u670D\u52A1\u7AEF " : "") + out;
      }
    }
    let translated = line;
    for (const [re, zh] of PHRASES) translated = translated.replace(re, zh);
    return (isServer ? "\u670D\u52A1\u7AEF " : "") + translated;
  }
  function summarizeScrcpyOptions(o) {
    const line1 = [];
    const line2 = [];
    const add1 = (k, v) => {
      if (v !== void 0 && v !== null && v !== "" && v !== false) line1.push(k + " " + v);
    };
    const add2 = (k, v) => {
      if (v !== void 0 && v !== null && v !== "" && v !== false) line2.push(k + " " + v);
    };
    add1("\u53C2\u6570\u7248\u672C", o.serverVersion);
    add1("\u753B\u9762", o.maxSize ? o.maxSize + "px" : "\u539F\u59CB\u5C3A\u5BF8");
    add1("\u5E27\u7387", o.fps ? o.fps + "fps" : "\u4E0D\u9650");
    add1("\u7801\u7387", o.bitrate ? Math.round(Number(o.bitrate) / 1e6) + "Mbps" : "");
    add1("\u89C6\u9891\u6E90", { display: "\u5C4F\u5E55", camera_back: "\u540E\u6444", camera_front: "\u524D\u6444" }[o.source] || o.source);
    add2("\u97F3\u9891", o.audioOn ? "\u5F00" : "\u5173");
    if (o.audioOn) add2("\u6765\u6E90", { both: "\u5185\u5F55+\u9EA6\u514B\u98CE", mic: "\u9EA6\u514B\u98CE", playback: "\u5185\u5F55" }[o.audioMode] || o.audioMode);
    if (o.audioDup) add2("\u590D\u5236", "\u624B\u673A\u4E0E\u7535\u8111\u540C\u65F6\u51FA\u58F0");
    if (o.stayAwake) add2("\u4FDD\u6301\u5524\u9192", "\u5F00");
    if (o.showTouches) add2("\u663E\u793A\u89E6\u6478", "\u5F00");
    if (o.powerOffOnClose) add2("\u5173\u95ED\u706D\u5C4F", "\u5F00");
    return "\u542F\u52A8\u53C2\u6570 \xB7 " + line1.join(" \xB7 ") + (line2.length ? "\n\u97F3\u9891\u8BBE\u7F6E \xB7 " + line2.join(" \xB7 ") : "");
  }

  // src/wireless.js
  var WirelessError = class extends Error {
    constructor(message, code = "WIRELESS_ERROR", cause) {
      super(message, { cause });
      this.name = "WirelessError";
      this.code = code;
    }
  };
  function parseHeader(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, 24);
    return {
      command: dv.getUint32(0, true),
      arg0: dv.getUint32(4, true),
      arg1: dv.getUint32(8, true),
      payloadLength: dv.getUint32(12, true),
      checksum: dv.getUint32(16, true),
      magic: dv.getUint32(20, true)
    };
  }
  function encodePacket(packet) {
    const payload = packet.payload || new Uint8Array(0);
    const header = AdbPacketHeader.serialize({
      command: packet.command,
      arg0: packet.arg0 | 0,
      arg1: packet.arg1 | 0,
      payloadLength: payload.length,
      checksum: payload.length ? Array.from(payload).reduce((a, b) => a + b & 4294967295, 0) : 0,
      magic: (packet.command ^ 4294967295) >>> 0
    });
    const out = new Uint8Array(header.length + payload.length);
    out.set(header, 0);
    if (payload.length) out.set(payload, header.length);
    return out;
  }
  function createAdbConnection(ws) {
    let buffer2 = new Uint8Array(0);
    let lastRecv = Date.now();
    const readable = new ReadableStream2({
      start(controller) {
        ws.binaryType = "arraybuffer";
        ws.addEventListener("message", (ev) => {
          lastRecv = Date.now();
          const chunk = new Uint8Array(ev.data);
          const merged = new Uint8Array(buffer2.length + chunk.length);
          merged.set(buffer2, 0);
          merged.set(chunk, buffer2.length);
          buffer2 = merged;
          while (buffer2.length >= 24) {
            const header = parseHeader(buffer2.subarray(0, 24));
            const payloadLength = header.payloadLength >>> 0;
            if (buffer2.length < 24 + payloadLength) break;
            const payload = buffer2.slice(24, 24 + payloadLength);
            buffer2 = buffer2.slice(24 + payloadLength);
            controller.enqueue({
              command: header.command,
              arg0: header.arg0,
              arg1: header.arg1,
              payload,
              checksum: header.checksum,
              magic: header.magic
            });
          }
        });
        ws.addEventListener("close", (ev) => {
          const code = ev && ev.code;
          const reason = ev && ev.reason ? ev.reason : "";
          console.warn("[wireless] WS closed", code, reason);
          try {
            window.__wirelessLog = window.__wirelessLog || [];
            window.__wirelessLog.push({ t: Date.now(), ev: "ws-close", code, reason });
          } catch {
          }
          try {
            controller.close();
          } catch {
          }
        });
        ws.addEventListener("error", (e) => {
          console.warn("[wireless] WS error", e);
          controller.error(e);
        });
      }
    });
    const writable = new WritableStream({
      write(chunk) {
        if (ws.readyState !== 1) throw new WirelessError("WebSocket \u672A\u5C31\u7EEA", "WS_CLOSED");
        const packet = chunk instanceof Consumable ? chunk.value : chunk?.value ?? chunk;
        let bytes;
        if (packet instanceof Uint8Array) {
          bytes = packet;
        } else if (packet && typeof packet === "object" && "command" in packet) {
          bytes = encodePacket(packet);
        } else {
          bytes = new Uint8Array(packet || []);
        }
        if (ws.readyState !== 1) return;
        ws.send(bytes);
        if (chunk instanceof Consumable) chunk.consume();
      },
      close() {
        try {
          ws.close();
        } catch {
        }
      }
    });
    return { readable, writable, lastRecv: () => lastRecv };
  }
  async function openAdbBridge(target, timeoutMs = 1e4) {
    const wsUrl = `ws://${location.hostname}:${location.port || 8765}/ws/adb?target=${encodeURIComponent(target)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new WirelessError("\u8FDE\u63A5\u672C\u5730 ADB \u670D\u52A1\u8D85\u65F6", "USB_BRIDGE_TIMEOUT")),
        timeoutMs
      );
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new WirelessError("\u65E0\u6CD5\u8FDE\u63A5\u672C\u5730\u670D\u52A1\u6865\uFF08serve.py\uFF09", "USB_BRIDGE_FAIL"));
      });
      ws.addEventListener("close", () => {
        clearTimeout(timer);
        reject(new WirelessError("\u672C\u5730 ADB \u670D\u52A1\u901A\u9053\u5DF2\u5173\u95ED", "USB_BRIDGE_CLOSED"));
      });
    });
    return ws;
  }
  function createRawBridgeConnection(ws) {
    const readable = new ReadableStream2({
      start(controller) {
        ws.binaryType = "arraybuffer";
        ws.addEventListener("message", (ev) => {
          controller.enqueue(new Uint8Array(ev.data));
        });
        ws.addEventListener("close", () => {
          try {
            controller.close();
          } catch {
          }
        });
        ws.addEventListener("error", (e) => {
          try {
            controller.error(e);
          } catch {
          }
        });
      }
    });
    const writable = new WritableStream({
      write(chunk) {
        if (ws.readyState !== 1) throw new WirelessError("ADB Server \u901A\u9053\u672A\u5C31\u7EEA", "USB_BRIDGE_CLOSED");
        const value = chunk instanceof Consumable ? chunk.value : chunk?.value ?? chunk;
        const bytes = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value || []);
        ws.send(bytes);
        if (chunk instanceof Consumable) chunk.consume();
      },
      close() {
        try {
          ws.close();
        } catch {
        }
      }
    });
    return { readable, writable };
  }
  function createUsbDeviceTransport(selected) {
    const transportId = selected.transport_id || selected.transportId || 1;
    const serial = selected.serial;
    const model = selected.model || serial;
    const product = selected.product || model;
    const device = selected.device || model;
    const openTransport = async () => {
      const ws = await openAdbBridge("127.0.0.1:5037");
      const connection = createRawBridgeConnection(ws);
      const writer = connection.writable.getWriter();
      const reader = connection.readable.getReader();
      let closed2 = false;
      const close = async () => {
        try {
          ws.close();
        } catch {
        }
        closed2 = true;
      };
      try {
        await writer.write(new TextEncoder().encode(`host:transport-id:${transportId}`));
        const { value } = await reader.read();
        const text = value ? new TextDecoder().decode(value) : "";
        if (text.slice(0, 4) !== "OKAY") {
          throw new WirelessError("ADB Server \u62D2\u7EDD\u8BBE\u5907\u901A\u9053\uFF1A" + text, "USB_CONNECT_FAIL");
        }
      } catch (e) {
        await close();
        throw e;
      }
      const readable = new ReadableStream2({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done || closed2) {
              controller.close();
              return;
            }
            controller.enqueue(value);
          } catch (e) {
            controller.error(e);
          }
        }
      });
      return {
        readable,
        writable: connection.writable,
        closed: new Promise((resolve) => {
          ws.addEventListener("close", resolve);
        }),
        close
      };
    };
    return {
      serial,
      name: model,
      product,
      model,
      device,
      transportId,
      banner: {
        product,
        model,
        device,
        features: /* @__PURE__ */ new Set(["shell_v2", "cmd", "stat_v2"])
      },
      connect: openTransport,
      async addReverseTunnel() {
        throw new AdbReverseNotSupportedError();
      },
      async removeReverseTunnel() {
        throw new AdbReverseNotSupportedError();
      },
      async clearReverseTunnels() {
        throw new AdbReverseNotSupportedError();
      },
      async close() {
      }
    };
  }
  async function connectUsbDirect(preferSerial, onStatus = () => {
  }) {
    onStatus("\u68C0\u67E5\u6709\u7EBF\u8BBE\u5907\u2026");
    let payload = {};
    try {
      const resp = await fetch("/api/adb-usb", { method: "POST" });
      payload = await resp.json();
    } catch (e) {
      throw new WirelessError("\u672C\u5730 ADB \u670D\u52A1\u4E0D\u53EF\u7528\uFF1A" + (e?.message || e), "USB_SERVER_FAIL", e);
    }
    if (!payload?.ok) {
      throw new WirelessError(payload?.error || "\u672C\u673A ADB \u65E0\u6CD5\u8BFB\u53D6\u6709\u7EBF\u8BBE\u5907", "USB_SERVER_FAIL");
    }
    const devices = Array.isArray(payload.devices) ? payload.devices : [];
    if (!devices.length) {
      throw new WirelessError("\u672A\u68C0\u6D4B\u5230 USB \u8BBE\u5907\u3002\u8BF7\u63D2\u597D\u6570\u636E\u7EBF\u5E76\u5F00\u542F USB \u8C03\u8BD5", "USB_NO_DEVICE");
    }
    const authorized = devices.filter((d) => d.state === "device");
    if (!authorized.length) {
      throw new WirelessError(
        "\u624B\u673A\u5C1A\u672A\u6388\u6743 USB \u8C03\u8BD5\u3002\u8BF7\u67E5\u770B\u624B\u673A\u5E76\u52FE\u9009\u300C\u59CB\u7EC8\u5141\u8BB8\u300D\u540E\u70B9\u300C\u786E\u5B9A\u300D",
        "USB_AUTH_REQUIRED"
      );
    }
    const selected = preferSerial && authorized.find((d) => d.serial === preferSerial) || authorized[0];
    onStatus("\u6709\u7EBF\u76F4\u8FDE " + selected.serial + "\u2026");
    let adb;
    try {
      onStatus("ADB Server \u901A\u9053\u5C31\u7EEA\uFF0C\u8FDE\u63A5\u8BBE\u5907\u2026");
      adb = new Adb(createUsbDeviceTransport(selected));
    } catch (e) {
      throw new WirelessError("\u6709\u7EBF ADB \u76F4\u8FDE\u5931\u8D25\uFF1A" + (e?.message || e), "USB_CONNECT_FAIL", e);
    }
    onStatus("\u6709\u7EBF\u5DF2\u8FDE\u63A5");
    return {
      adb,
      serial: selected.serial,
      name: selected.model || selected.serial,
      dispose: async () => {
        try {
          await adb.close();
        } catch {
        }
      }
    };
  }
  async function prepareUsbServer(serial, onStatus = () => {
  }) {
    onStatus("\u4E0A\u4F20 scrcpy-server\u2026");
    let payload = {};
    try {
      const resp = await fetch("/api/usb-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial })
      });
      payload = await resp.json();
    } catch (e) {
      throw new WirelessError("\u6709\u7EBF server \u4E0A\u4F20\u8BF7\u6C42\u5931\u8D25\uFF1A" + (e?.message || e), "USB_PUSH_FAIL", e);
    }
    if (!payload?.ok) {
      throw new WirelessError(payload?.error || "\u6709\u7EBF server \u4E0A\u4F20\u5931\u8D25", "USB_PUSH_FAIL");
    }
  }
  async function enableWirelessViaUsb(adb, port = 5555) {
    if (!adb) throw new WirelessError("\u8BF7\u5148\u5B8C\u6210 USB \u8FDE\u63A5", "NO_USB");
    let ip = "";
    const cmds = [
      ["ip", "-f", "inet", "addr", "show", "wlan0"],
      ["ip", "-f", "inet", "addr", "show", "rmnet_data0"],
      ["getprop", "dhcp.wlan0.ipaddress"],
      ["getprop", "dhcp.wlan1.ipaddress"],
      ["getprop", "net.hostname"]
    ];
    for (const argv of cmds) {
      try {
        const text = await adb.subprocess.noneProtocol.spawnWaitText(argv);
        const m = /inet\s+(\d+\.\d+\.\d+\.\d+)/.exec(text || "") || /(\d+\.\d+\.\d+\.\d+)/.exec(text || "");
        if (m && !m[1].startsWith("127.")) {
          ip = m[1];
          break;
        }
      } catch {
      }
    }
    let portText = "";
    try {
      portText = await adb.createSocketAndWait(`tcpip:${port}`);
    } catch (e) {
      throw new WirelessError("\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\u5931\u8D25\uFF1A" + (e?.message || e), "TCPIP_FAIL", e);
    }
    return {
      ip,
      port,
      target: ip ? `${ip}:${port}` : "",
      message: portText || "ok"
    };
  }
  async function scanWireless(timeoutMs = 2500) {
    try {
      const ctrl2 = new AbortController();
      const t = setTimeout(() => ctrl2.abort(), timeoutMs + 1500);
      const resp = await fetch("/api/wifi-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: 5555, timeout: Math.ceil(timeoutMs / 1e3) }),
        signal: ctrl2.signal
      });
      clearTimeout(t);
      const data = await resp.json();
      return data.devices || [];
    } catch (e) {
      throw new WirelessError("\u626B\u63CF\u5931\u8D25\uFF1A" + (e?.message || e), "SCAN_FAIL", e);
    }
  }
  async function connectWireless(target, onStatus = () => {
  }) {
    const t = String(target || "").trim();
    if (!t || !/^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(t)) {
      throw new WirelessError("\u8BF7\u586B\u5199 IP:\u7AEF\u53E3\uFF0C\u4F8B\u5982 192.168.1.8:5555", "BAD_TARGET");
    }
    const wsUrl = `ws://${location.hostname}:${location.port || 8765}/ws/adb?target=${encodeURIComponent(t)}`;
    onStatus(`\u8FDE\u63A5\u65E0\u7EBF ${t}\u2026`);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new WirelessError("\u65E0\u7EBF\u8FDE\u63A5\u8D85\u65F6\uFF08\u8BF7\u786E\u8BA4\u624B\u673A\u5DF2\u5F00\u65E0\u7EBF\u8C03\u8BD5\u4E14 IP \u6B63\u786E\uFF09", "WS_TIMEOUT")),
        1e4
      );
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new WirelessError("\u65E0\u6CD5\u8FDE\u63A5\u672C\u5730\u670D\u52A1\u6865\uFF08serve.py\uFF09", "WS_FAIL"));
      });
      ws.addEventListener("close", () => {
        clearTimeout(timer);
        reject(new WirelessError("\u65E0\u7EBF\u901A\u9053\u5DF2\u5173\u95ED", "WS_CLOSED"));
      });
    });
    const connection = createAdbConnection(ws);
    onStatus("ADB \u63E1\u624B\u4E2D\u2026");
    let transport;
    const authTask = AdbDaemonTransport.authenticate({
      serial: t,
      connection,
      credentialStore: new AdbWebCredentialStore("PandaTestLocal"),
      readTimeLimit: 0
    });
    authTask.catch(() => {
    });
    const authTimeout = Math.max(
      8e3,
      Number(new URLSearchParams(location.search).get("auth_timeout")) || 3e4
    );
    try {
      transport = await Promise.race([
        authTask,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new WirelessError(
                "ADB \u63E1\u624B\u8D85\u65F6\uFF08" + Math.round(authTimeout / 1e3) + "s\uFF09\u3002\u82E5\u624B\u673A\u5F39\u51FA\u300C\u5141\u8BB8 USB \u8C03\u8BD5\u300D\u8BF7\u70B9\u5141\u8BB8\uFF1B\u5426\u5219\u91CD\u65B0\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\u540E\u518D\u8FDE",
                "AUTH_TIMEOUT"
              )
            );
          }, authTimeout);
        })
      ]);
    } catch (err) {
      try {
        ws.close();
      } catch {
      }
      throw new WirelessError(
        "\u65E0\u7EBF ADB \u63E1\u624B\u5931\u8D25\u3002\u8BF7\uFF1A\u540C\u4E00 Wi-Fi \u2192 USB \u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\uFF08\u5F005555\uFF09\u2192 \u62D4\u7EBF\u540E\u8FDE\u63A5 IP:5555",
        "AUTH_FAIL",
        err
      );
    }
    const adb = new Adb(transport);
    onStatus("\u65E0\u7EBF\u5DF2\u8FDE\u63A5");
    return {
      adb,
      target: t,
      lastRecv: connection.lastRecv,
      dispose: async () => {
        try {
          await adb.close();
        } catch {
        }
        try {
          ws.close();
        } catch {
        }
      }
    };
  }
  function wirelessHelp() {
    return [
      "1. \u624B\u673A\u4E0E\u7535\u8111\u540C\u4E00 Wi-Fi",
      "2. USB \u8FDE\u63A5\u540E\u70B9\u300C\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\u300D\uFF08\u7B49\u4EF7 adb tcpip 5555\uFF09",
      "3. \u62D4\u7EBF\uFF0C\u586B \u624B\u673AIP:5555 \u70B9\u300C\u8FDE\u63A5\u300D",
      "4. \u6216\u70B9\u300C\u641C\u7D22\u672C\u5730 IP\u300D\u81EA\u52A8\u53D1\u73B0"
    ].join("\n");
  }

  // src/mirror.js
  var SERVER_URL = "./assets/scrcpy-server.jar";
  function extractH264ParameterSets(data) {
    if (!(data instanceof Uint8Array) || data.length < 8) return null;
    const starts = [];
    for (let i = 0; i + 4 <= data.length; i += 1) {
      if (data[i] !== 0 || data[i + 1] !== 0) continue;
      if (data[i + 2] === 1) {
        starts.push({ offset: i, header: i + 3 });
        i += 2;
      } else if (data[i + 2] === 0 && data[i + 3] === 1) {
        starts.push({ offset: i, header: i + 4 });
        i += 3;
      }
    }
    if (!starts.length) return null;
    const parts = [];
    let hasSps = false;
    let hasPps = false;
    for (let index = 0; index < starts.length; index += 1) {
      const { offset, header } = starts[index];
      const end = index + 1 < starts.length ? starts[index + 1].offset : data.length;
      const nalType = data[header] & 31;
      if (nalType === 7) hasSps = true;
      else if (nalType === 8) hasPps = true;
      else continue;
      parts.push(data.subarray(offset, end));
    }
    if (!hasSps || !hasPps) return null;
    const total = parts.reduce((size, part) => size + part.length, 0);
    const config = new Uint8Array(total);
    let cursor = 0;
    for (const part of parts) {
      config.set(part, cursor);
      cursor += part.length;
    }
    return config;
  }
  function h264HasSlice(data) {
    if (!(data instanceof Uint8Array)) return false;
    for (let i = 0; i + 3 < data.length; i += 1) {
      const shortStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
      const longStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1;
      if (!shortStart && !longStart) continue;
      const header = i + (shortStart ? 3 : 4);
      const nalType = data[header] & 31;
      if (nalType === 1 || nalType === 5) return true;
    }
    return false;
  }
  function h264HasIdr(data) {
    if (!(data instanceof Uint8Array)) return false;
    for (let i = 0; i + 3 < data.length; i += 1) {
      const shortStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
      const longStart = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1;
      if (!shortStart && !longStart) continue;
      const header = i + (shortStart ? 3 : 4);
      if ((data[header] & 31) === 5) return true;
    }
    return false;
  }
  function patchV5AudioMeta(options) {
    const codecMap = {
      raw: ScrcpyAudioCodec.Raw,
      opus: ScrcpyAudioCodec.Opus,
      aac: ScrcpyAudioCodec.Aac,
      flac: ScrcpyAudioCodec.Flac
    };
    const codec = codecMap[String(options.value.audioCodec || "raw").toLowerCase()] || ScrcpyAudioCodec.Raw;
    const makeStream = (pending, reader) => new ReadableStream2({
      start(controller) {
        controller.enqueue(pending);
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (e) {
          controller.error(e);
        }
      },
      cancel() {
        try {
          reader.cancel();
        } catch {
        }
      }
    });
    options.parseAudioStreamMetadata = createV5AudioMetaParser(codec, makeStream);
  }
  var GUARD_PATH = "/data/local/tmp/panda_guard.sh";
  var GUARD_LOG = "/data/local/tmp/panda_guard.log";
  var GUARD_HB = "/data/local/tmp/panda_hb";
  var GUARD_RUN = "/data/local/tmp/panda_run";
  var GUARD_STALE = 30;
  var GUARD_IDLE_EXIT = 60;
  var AUDIO_ROUTE_CMD = `v=$(media volume --stream 3 --get 2>/dev/null | tr -d ' ' | sed -n 's/.*:\\([0-9]*\\)\\/.*/\\1/p' | head -n 1); case "$v" in ""|*[!0-9]*) v="";; esac; if [ -n "$v" ]; then media volume --stream 3 --set $((v+1)) >/dev/null 2>&1; media volume --stream 3 --set $v >/dev/null 2>&1; fi; true`;
  function newGuardSession() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  var guardHbPath = (session) => GUARD_HB + "." + session;
  var guardRunPath = (session) => GUARD_RUN + "." + session;
  var MirrorError = class extends Error {
    constructor(message, code = "MIRROR_ERROR", cause) {
      super(message, { cause });
      this.name = "MirrorError";
      this.code = code;
      this.guide = guideFor(code);
    }
  };
  function guideFor(code) {
    const map = {
      NO_WEBUSB: "\u8BF7\u4F7F\u7528 Chrome \u6216 Edge\uFF0C\u5E76\u901A\u8FC7 http://localhost \u6216 https \u6253\u5F00\u3002",
      NO_MANAGER: "\u6D4F\u89C8\u5668\u672A\u66B4\u9732 WebUSB\uFF0C\u8BF7\u5173\u95ED\u65E0\u5173\u6269\u5C55\u540E\u91CD\u8BD5\u3002",
      NO_DEVICE: "\u8BF7\u5728\u7CFB\u7EDF\u5F39\u7A97\u4E2D\u9009\u62E9\u4F60\u7684 Android \u624B\u673A\u3002",
      DEVICE_BUSY: "\u5173\u95ED\u7535\u8111\u4E0A\u7684 adb / \u624B\u673A\u52A9\u624B / \u5176\u5B83\u6295\u5C4F\u5DE5\u5177\uFF0C\u6216\u6267\u884C adb kill-server \u540E\u91CD\u8BD5\u3002",
      USB_FAIL: "\u6362\u6839\u6570\u636E\u7EBF/USB \u53E3\uFF0C\u624B\u673A\u9009\u300C\u4F20\u8F93\u6587\u4EF6\u300D\u6A21\u5F0F\uFF0C\u5E76\u5F00\u542F USB \u8C03\u8BD5\u3002",
      AUTH_TIMEOUT: "\u770B\u624B\u673A\u5C4F\u5E55\uFF1A\u52FE\u9009\u300C\u59CB\u7EC8\u5141\u8BB8\u300D\u5E76\u70B9\u300C\u786E\u5B9A\u300D\u3002\u82E5\u65E0\u5F39\u7A97\uFF0C\u64A4\u9500 USB \u8C03\u8BD5\u6388\u6743\u540E\u91CD\u63D2\u3002",
      AUTH_REJECTED: "\u624B\u673A\u4E0A\u70B9\u4E86\u62D2\u7EDD\u3002\u8BF7\u64A4\u9500 USB \u8C03\u8BD5\u6388\u6743\u540E\u91CD\u65B0\u8FDE\u63A5\u3002",
      NO_DEVICE_FOUND: "\u7CFB\u7EDF\u672A\u627E\u5230 ADB \u63A5\u53E3\u3002\u786E\u8BA4\u5DF2\u5F00\u542F USB \u8C03\u8BD5\uFF1B\u90E8\u5206\u7535\u8111\u9700\u5C06\u9A71\u52A8\u6362\u6210 WinUSB\uFF08Zadig\uFF09\u3002",
      SCRCPY_FAIL: "scrcpy-server \u542F\u52A8\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u63D2\u62D4\u624B\u673A\u540E\u91CD\u8BD5\u3002",
      NO_VIDEO: "\u89C6\u9891\u6D41\u4E3A\u7A7A\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u4ECD\u5931\u8D25\u8BF7\u67E5\u770B Console\u3002",
      NO_SERVER: "scrcpy \u4FBF\u6377\u7F51\u9875\u7248\u670D\u52A1\u53EF\u80FD\u5DF2\u505C\u6B62\u3002\u8BF7\u91CD\u65B0\u542F\u52A8\u670D\u52A1\u540E\u5237\u65B0\u9875\u9762\uFF1B\u82E5\u670D\u52A1\u4ECD\u5728\u8FD0\u884C\uFF0C\u8BF7\u786E\u8BA4\u901A\u8FC7 http://127.0.0.1:\u7AEF\u53E3/control.html \u6253\u5F00\uFF0C\u800C\u4E0D\u662F file://\u3002"
    };
    return map[code] || "\u8BF7\u68C0\u67E5 USB \u8FDE\u63A5\u3001USB \u8C03\u8BD5\u4E0E\u6388\u6743\u5F39\u7A97\u3002";
  }
  function isUsbSupported() {
    return typeof navigator !== "undefined" && !!navigator.usb;
  }
  function createRenderer() {
    if (WebGLVideoFrameRenderer.isSupported) {
      return { renderer: new WebGLVideoFrameRenderer(void 0, true), kind: "webgl" };
    }
    return { renderer: new BitmapVideoFrameRenderer(), kind: "bitmap" };
  }
  var PacedRenderer = class {
    constructor(inner, maxFps, hooks) {
      this.inner = inner;
      this.hooks = hooks || {};
      const fpsIn = Number(maxFps);
      const effective = Number.isFinite(fpsIn) && fpsIn > 0 ? fpsIn : 120;
      const fps = Math.max(30, Math.min(effective, 120));
      this.interval = 1e3 / fps;
      this._next = 0;
      this.dropped = 0;
      this.rendered = 0;
    }
    get canvas() {
      return this.inner.canvas;
    }
    setSize(width, height) {
      this.inner.setSize(width, height);
    }
    draw(frame) {
      const now = performance.now();
      const arrived = this.hooks.takeArrival ? this.hooks.takeArrival() : 0;
      if (now < this._next - 1) {
        this.dropped += 1;
        return;
      }
      this._next = Math.max(this._next, now) + this.interval;
      this.rendered += 1;
      if (arrived && this.hooks.onLatency) {
        this.hooks.onLatency(Date.now() - arrived);
      }
      return this.inner.draw(frame);
    }
  };
  var AdbMirror = class {
    constructor({ stage, status, onStatus, onError, onStats, onFirstFrame, onController, onLog, onBeforeTeardown }) {
      this.stage = stage;
      this.statusEl = status;
      this.onStatus = onStatus || (() => {
      });
      this.onError = onError || (() => {
      });
      this.onStats = onStats || (() => {
      });
      this.onFirstFrame = onFirstFrame || (() => {
      });
      this.onController = onController || (() => {
      });
      this.onLog = onLog || (() => {
      });
      this.onBeforeTeardown = onBeforeTeardown || (() => {
      });
      this._opts = {};
      this.adb = null;
      this.client = null;
      this.decoder = null;
      this.device = null;
      this.canvas = null;
      this.deviceController = null;
      this.rendererKind = "";
      this.running = false;
      this.frames = 0;
      this.startTs = 0;
      this._pktArrivals = [];
      this._latencyMs = null;
      this._fpsWinStart = 0;
      this._fpsWinCount = 0;
      this._fps = "0";
      this._size = { width: 0, height: 0 };
      this._stopRequested = false;
      this.credentialStore = new AdbWebCredentialStore("PandaTestLocal");
      this.audio = new AudioMirror();
      this._wirelessDispose = null;
      this._wirelessTarget = "";
      this._sdk = 0;
      this._cleaned = false;
      this._lateTimer = null;
      this._lateActive = false;
      this.muted = false;
      this._awakeSaved = null;
      this._awakeApplied = false;
      this._dropHandled = false;
      this._usbDisconnectHandler = null;
      this._usbServerBytes = null;
      this._usbServerBytesAt = 0;
      this._serverJarPrefetch = null;
      this._diagLastPacketAt = 0;
      this._diagLastPacketKind = "";
      this._diagLastDecoderError = "";
      this._diagUsbEvent = "";
    }
    _detachUsbDisconnect() {
      if (typeof navigator === "undefined" || !navigator.usb || !this._usbDisconnectHandler) return;
      navigator.usb.removeEventListener("disconnect", this._usbDisconnectHandler);
      this._usbDisconnectHandler = null;
    }
    async _closeUsbHandle() {
      this._detachUsbDisconnect();
      const device = this.device;
      this.device = null;
      this._usbServerUploaded = "";
      if (!device?.raw?.opened) return;
      try {
        await device.raw.close();
      } catch {
      }
    }
    /** 息屏时间快照的本地键：按设备序列号区分，页面被关闭后下次连接仍能补恢复 */
    _awakeStoreKey() {
      const id = String(this._wirelessTarget || this.device?.serial || "").trim();
      return id ? "scrcpy-awake-timeout:" + id : "";
    }
    _readAwakeStored() {
      const key = this._awakeStoreKey();
      if (!key) return null;
      try {
        const raw = localStorage.getItem(key);
        const n = Number(raw);
        return raw != null && Number.isFinite(n) && n >= 0 ? n : null;
      } catch {
        return null;
      }
    }
    _writeAwakeStored(value) {
      const key = this._awakeStoreKey();
      if (!key) return;
      try {
        localStorage.setItem(key, String(value));
      } catch {
      }
    }
    _clearAwakeStored() {
      const key = this._awakeStoreKey();
      if (!key) return;
      try {
        localStorage.removeItem(key);
      } catch {
      }
    }
    status(text) {
      if (this.statusEl) this.statusEl.textContent = text;
      this.onStatus(text);
    }
    /** 当前连接的设备标识（无线用 IP:端口，USB 用序列号），供按设备记忆设置 */
    get serialKey() {
      return String(this._wirelessTarget || this.device?.serial || "").trim();
    }
    /** 关闭 ADB 通道前执行收尾钩子，2.5 秒超时兜底，避免断流被卡住 */
    async _runBeforeTeardown() {
      try {
        await Promise.race([
          Promise.resolve(this.onBeforeTeardown()),
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch (e) {
        this.onLog("before-teardown \u94A9\u5B50\u5931\u8D25: " + (e && e.message ? e.message : e));
      }
    }
    /** 连接环境自检 */
    async diagnose() {
      const result = {
        webusb: isUsbSupported(),
        secure: typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1"),
        manager: !!AdbDaemonWebUsbDeviceManager.BROWSER,
        authorizedDevices: 0,
        webcodecs: typeof VideoDecoder !== "undefined"
      };
      try {
        const list = await AdbDaemonWebUsbDeviceManager.BROWSER?.getDevices?.();
        result.authorizedDevices = list?.length || 0;
      } catch {
      }
      return result;
    }
    /** 列出已授权的 USB 设备(不弹系统选择器) */
    async listUsbDevices() {
      if (!isUsbSupported()) return [];
      const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!manager) return [];
      try {
        const list = await manager.getDevices();
        return (list || []).map((d) => ({
          serial: d.serial || d.name || "unknown",
          name: d.name || d.serial || "Android \u8BBE\u5907"
        }));
      } catch {
        return [];
      }
    }
    /** 弹出系统选择器让用户授权新设备 */
    async pickUsbDevice() {
      return await this.requestDevice();
    }
    async requestDevice(preferSerial, allowPicker = true, waitMs = 0) {
      if (!isUsbSupported()) {
        throw new MirrorError("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301 WebUSB", "NO_WEBUSB");
      }
      const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!manager) {
        throw new MirrorError("WebUSB \u8BBE\u5907\u7BA1\u7406\u5668\u4E0D\u53EF\u7528", "NO_MANAGER");
      }
      const deadline = Date.now() + Math.max(0, waitMs);
      for (; ; ) {
        try {
          const existing = await manager.getDevices();
          if (existing?.length) {
            const hit = preferSerial ? existing.find(
              (d) => d.serial === preferSerial || d.name === preferSerial || `${d.raw?.vendorId?.toString(16)}x${d.raw?.productId?.toString(16)}` === preferSerial
            ) : existing[0];
            if (hit) {
              this.device = hit;
              return hit;
            }
          }
        } catch {
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!allowPicker) {
        throw new MirrorError("\u5DF2\u6388\u6743 USB \u8BBE\u5907\u5C1A\u672A\u91CD\u65B0\u4E0A\u7EBF", "NO_DEVICE");
      }
      let device;
      try {
        device = await manager.requestDevice();
      } catch (err) {
        if (err?.name === "NotFoundError") {
          throw new MirrorError("\u672A\u9009\u62E9\u8BBE\u5907", "NO_DEVICE");
        }
        throw new MirrorError("\u9009\u62E9\u8BBE\u5907\u5931\u8D25\uFF1A" + (err?.message || err), "NO_DEVICE_FOUND", err);
      }
      if (!device) {
        throw new MirrorError("\u672A\u9009\u62E9\u8BBE\u5907 / \u672A\u627E\u5230 ADB \u63A5\u53E3", "NO_DEVICE_FOUND");
      }
      this.device = device;
      return device;
    }
    async connectAndAuth() {
      if (!this.device) throw new MirrorError("\u5C1A\u672A\u9009\u62E9 USB \u8BBE\u5907", "NO_DEVICE");
      this.status("\u6B63\u5728\u8FDE\u63A5 ADB\u2026");
      const acquireConnection = async () => {
        let connection = null;
        for (let attempt = 1; attempt <= 4; attempt += 1) {
          try {
            connection = await this.device.connect();
            return connection;
          } catch (err) {
            const busy = err?.name === "DeviceBusyError" || err?.name === "NetworkError" || /busy|in use|another program|NetworkError/i.test(String(err?.message || ""));
            if (busy && attempt < 4) {
              this.onLog("USB \u63A5\u53E3\u5C1A\u672A\u91CA\u653E\uFF0C\u7B49\u5F85\u540E\u91CD\u8BD5 " + attempt + "/3");
              this.status("USB \u63A5\u53E3\u91CA\u653E\u4E2D\uFF0C\u6B63\u5728\u91CD\u8BD5\u2026");
              try {
                await this.device?.raw?.close?.();
              } catch {
              }
              await new Promise((resolve) => setTimeout(resolve, 900));
              try {
                await this.requestDevice(this._preferSerial || this.device?.serial || "", false, 5e3);
              } catch {
              }
              continue;
            }
            if (busy) {
              throw new MirrorError(
                "\u8BBE\u5907\u6B63\u5728\u88AB\u5176\u4ED6\u7A0B\u5E8F\u4F7F\u7528\uFF08adb / \u624B\u673A\u52A9\u624B / \u5176\u5B83 WebUSB \u9875\uFF09\u3002",
                "DEVICE_BUSY",
                err
              );
            }
            throw new MirrorError("USB \u8FDE\u63A5\u5931\u8D25\uFF1A" + (err?.message || err), "USB_FAIL", err);
          }
        }
        throw new MirrorError("USB \u63A5\u53E3\u4E00\u76F4\u88AB\u5360\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", "DEVICE_BUSY");
      };
      let transport = null;
      for (let round = 1; round <= 3 && !transport; round += 1) {
        const connection = await acquireConnection();
        this.status("\u7B49\u5F85\u8BBE\u5907\u6388\u6743\u2026\uFF08\u8BF7\u5728\u624B\u673A\u4E0A\u70B9\u300C\u5141\u8BB8 USB \u8C03\u8BD5\u300D\uFF09");
        let authTimer = null;
        try {
          transport = await Promise.race([
            AdbDaemonTransport.authenticate({
              serial: this.device.serial,
              connection,
              credentialStore: this.credentialStore
            }),
            new Promise((_, reject) => {
              authTimer = setTimeout(() => reject(new Error("ADB authentication timeout")), 15e3);
            })
          ]);
        } catch (err) {
          const msg = String(err?.message || err);
          try {
            await connection?.close?.();
          } catch {
          }
          const transient = /closed unexpectedly|readable ended|ExactReadable|NetworkError|disconnected|connection.*closed|timeout/i.test(
            msg
          );
          if (transient && round < 3) {
            this.onLog("USB \u63E1\u624B\u88AB\u5173\u95ED\uFF0C\u91CD\u8FDE " + round + "/2");
            this.status("USB \u8FDE\u63A5\u5DF2\u5173\u95ED\uFF0C\u6B63\u5728\u91CD\u8FDE\u2026");
            try {
              await this.device?.raw?.close?.();
            } catch {
            }
            await new Promise((resolve) => setTimeout(resolve, 1200));
            try {
              await this.requestDevice(this._preferSerial || this.device?.serial || "", false, 5e3);
            } catch {
            }
            continue;
          }
          if (/timeout|stalled|read time limit/i.test(msg)) {
            throw new MirrorError(
              "\u8BBE\u5907\u6388\u6743\u8D85\u65F6\u3002\u8BF7\u770B\u624B\u673A\uFF1A\u52FE\u9009\u300C\u59CB\u7EC8\u5141\u8BB8\u300D\u5E76\u70B9\u300C\u786E\u5B9A\u300D",
              "AUTH_TIMEOUT",
              err
            );
          }
          if (/authenticator|rejected|refused/i.test(msg)) {
            throw new MirrorError("\u8BBE\u5907\u6388\u6743\u88AB\u62D2\u7EDD\u3002\u8BF7\u64A4\u9500 USB \u8C03\u8BD5\u6388\u6743\u540E\u91CD\u65B0\u8FDE\u63A5", "AUTH_REJECTED", err);
          }
          throw new MirrorError("ADB \u8BA4\u8BC1\u5931\u8D25\uFF1A" + msg, "AUTH_FAIL", err);
        } finally {
          clearTimeout(authTimer);
        }
      }
      if (!transport) {
        throw new MirrorError("ADB \u8BA4\u8BC1\u5931\u8D25\uFF1AUSB \u8FDE\u63A5\u53CD\u590D\u88AB\u5173\u95ED", "AUTH_FAIL");
      }
      this.adb = new Adb(transport);
      this.status("ADB \u5DF2\u8FDE\u63A5");
      return this.adb;
    }
    /**
     * 在手机端执行一条真正的 shell 命令。
     * 关键：exec: 通道(noneProtocol)不经过 sh，引号/管道/; /& 全部失效，
     * 所以清理类命令必须走 shell,v2 或 shell:(pty)，这里的 pkill 才真的会执行。
     */
    async deviceShell(cmd, timeoutMs = 8e3) {
      const sub = this.adb?.subprocess;
      if (!sub) return "";
      const command = String(cmd);
      const withTimeout2 = (p) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
      try {
        if (sub.shellProtocol) {
          const r = await withTimeout2(sub.shellProtocol.spawnWaitText(command));
          return String(r && r.stdout || "");
        }
        const proc = await sub.noneProtocol.pty(command);
        const out = await withTimeout2(
          proc.output.pipeThrough(new TextDecoderStream()).pipeThrough(new ConcatStringStream())
        );
        try {
          proc.kill?.();
        } catch {
        }
        return String(out || "");
      } catch {
        return "";
      }
    }
    /** 手机端残留的 scrcpy 进程 pid */
    async listScrcpyPids() {
      const out = await this.deviceShell(
        "ps -A -o PID,ARGS 2>/dev/null | grep '[c]om.genymobile.scrcpy' | awk '{print $1}'",
        5e3
      );
      return String(out || "").split(/\s+/).filter((s) => /^\d+$/.test(s));
    }
    /**
     * 结束手机端 scrcpy，并且**回读确认真的结束了**。
     * 以前只发一次 pkill、不管结果，日志却写着「已结束」，实际进程还在占音频。
     * 现在整段清理在手机端一次跑完（TERM → 0.4s → KILL → 回读），只占一个 adb 往返。
     */
    async killScrcpyServerOnDevice() {
      if (!this.adb) return true;
      const out = String(
        await this.deviceShell(
          `pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.4; pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; sleep 0.2; echo "REMAIN=$(ps -A 2>/dev/null | grep -c '[c]om.genymobile.scrcpy')"`,
          12e3
        ) || ""
      );
      const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
      if (remain) {
        this.onLog("\u624B\u673A\u7AEF scrcpy \u4ECD\u5728\u8FD0\u884C\uFF08" + remain + " \u4E2A\u8FDB\u7A0B\uFF09\uFF0C\u97F3\u9891\u53EF\u80FD\u4ECD\u88AB\u5360\u7528");
        return false;
      }
      return true;
    }
    /**
     * 触发音频路由重算。部分机型 scrcpy 退出后播放路由仍停在被捕获的状态，需要一次刷新才恢复外放。
     *
     * v3.0.16 起不再按音量键（音量键会弹音量条、且会真的改变音量）。
     * 改为无界面等效刷新：读当前媒体音量 -> 抬高一格再原样写回，
     * setStreamVolume 一样会驱动 AudioService 重算路由，但屏幕上什么都不显示、净音量不变。
     */
    async refreshAudioRoute() {
      if (!this.adb) return;
      await this.deviceShell(AUDIO_ROUTE_CMD, 15e3);
    }
    /**
     * 读取手机端音频状态。
     * 「杀了进程还是没声」必须靠这个定位：是进程没杀掉、音量被静音、
     * 还是输出路由卡在 remote submix 上，三种情况的处理完全不同。
     */
    async diagnoseAudio() {
      if (!this.adb) return "";
      const cmd = 'echo "[scrcpy \u8FDB\u7A0B]"; ps -A 2>/dev/null | grep "[c]om.genymobile.scrcpy" || echo "\u65E0"; echo "[\u770B\u95E8\u72D7\u8FDB\u7A0B]"; ps -A 2>/dev/null | grep "[p]anda_guard.sh" || echo "\u65E0"; echo "[\u5A92\u4F53\u97F3\u91CF/\u9759\u97F3/\u8DEF\u7531]"; dumpsys audio 2>/dev/null | grep -iE "streamVolume|STREAM_MUSIC|muted|device=" | head -20; echo "[\u52FF\u6270 zen_mode]"; settings get global zen_mode 2>/dev/null; echo "[\u770B\u95E8\u72D7\u65E5\u5FD7]"; tail -n 8 ' + GUARD_LOG + ' 2>/dev/null || echo "\u65E0"';
      return String(await this.deviceShell(cmd, 15e3) || "").trim();
    }
    /** 没连着手机时先重连一次，保留连接用于下发恢复命令 */
    async ensureAdbForRepair() {
      if (this.adb) return true;
      if (!this._wirelessTarget) return false;
      try {
        const conn = await connectWireless(this._wirelessTarget, () => {
        });
        this.adb = conn.adb;
        return true;
      } catch {
        return false;
      }
    }
    /**
     * 强力恢复外放。按音量键都没声 = 不是音量归零，而是音频路由被卡住
     * （scrcpy 的 playback 采集把输出切到 remote submix，进程被杀后路由没回来）。
     * 按「能直接驱动 AudioService 重算路由」的力度从弱到强挨个试。
     * 只在用户主动点「恢复声音」时调用，不进自动流程，避免干扰正常投屏。
     */
    async forceAudioRestore() {
      if (!this.adb) return;
      await this.killScrcpyServerOnDevice();
      await this.deviceShell(
        "settings put global zen_mode 0 2>/dev/null; settings put system mode_ringer 2 2>/dev/null; true",
        6e3
      );
      await this.deviceShell("media volume --stream 3 --set 10 2>/dev/null; true", 6e3);
      await this.deviceShell(
        "input keyevent 126 >/dev/null 2>&1; sleep 0.4; input keyevent 127 >/dev/null 2>&1; true",
        6e3
      );
      await this.refreshAudioRoute();
    }
    /**
     * 会话开始前的一次性清理：把上一轮的看门狗、scrcpy 残留一起清掉，顺手读回 SDK 等级。
     * 以前这是 3~4 个 adb 往返 + 两次 sleep；现在整段在手机端跑完，只占一个往返。
     */
    async prepareDevice() {
      if (!this.adb) return { sdk: 0, remain: 0 };
      const out = String(
        await this.deviceShell(
          `pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.35; pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; echo "SDK=$(getprop ro.build.version.sdk)"; echo "REMAIN=$(ps -A 2>/dev/null | grep -c '[c]om.genymobile.scrcpy')"`,
          1e4
        ) || ""
      );
      const sdk = Number((/SDK=(\d+)/.exec(out) || [])[1] || 0);
      const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
      if (sdk > 0) this._sdk = sdk;
      if (remain) this.onLog("\u624B\u673A\u7AEF\u4ECD\u6709 " + remain + " \u4E2A scrcpy \u8FDB\u7A0B\u672A\u9000\u51FA\uFF0C\u7EE7\u7EED\u542F\u52A8\u53EF\u80FD\u62A2\u5360\u97F3\u9891");
      return { sdk, remain };
    }
    /**
     * v4.0.23 无线强制常亮。
     *
     * scrcpy 的 stay_awake 只改“插电时常亮”（stay_on_while_plugged_in），
     * 无线投屏时手机没有 AC/USB/Wireless 供电，系统仍按 screen_off_timeout 息屏。
     * 因此投屏期间临时把息屏时间设为最大值，并主动唤醒一次；原值保存在 _awakeSaved，
     * 由 stop / cleanupAfterDrop / _cleanupFailedStart 统一恢复。
     */
    async applyWirelessAwake() {
      if (!this._opts?.stayAwake || this._awakeApplied || !this.adb) return false;
      try {
        const raw = String(await this.deviceShell("settings get system screen_off_timeout", 6e3) || "").trim();
        let original = Number(raw);
        const stored = this._readAwakeStored();
        if (stored != null) {
          if (Number.isFinite(original) && original >= 2e9) {
            await this.deviceShell("settings put system screen_off_timeout " + stored, 6e3);
            original = stored;
            this.onLog("\u68C0\u6D4B\u5230\u4E0A\u6B21\u6295\u5C4F\u672A\u6062\u590D\u606F\u5C4F\u65F6\u95F4\uFF0C\u5DF2\u5148\u8865\u56DE " + Math.round(stored / 1e3) + " \u79D2");
          }
          this._clearAwakeStored();
        }
        if (!Number.isFinite(original) || original < 0 || original >= 2e9) {
          this._awakeSaved = null;
        } else {
          this._awakeSaved = original;
          this._writeAwakeStored(original);
        }
        this._awakeApplied = true;
        await this.deviceShell(
          "settings put system screen_off_timeout 2147483647; input keyevent 224 2>/dev/null; true",
          8e3
        );
        this.onLog(
          this._awakeSaved == null ? "\u5DF2\u5F00\u542F\u6295\u5C4F\u5F3A\u5236\u5E38\u4EAE\uFF08\u539F\u606F\u5C4F\u65F6\u95F4\u672A\u77E5\u6216\u5DF2\u662F\u6700\u5927\u503C\uFF0C\u505C\u6B62\u540E\u65E0\u6CD5\u81EA\u52A8\u6062\u590D\uFF09" : "\u5DF2\u5F00\u542F\u6295\u5C4F\u5F3A\u5236\u5E38\u4EAE\uFF08\u539F\u606F\u5C4F " + Math.round(this._awakeSaved / 1e3) + " \u79D2\uFF0C\u505C\u6B62\u540E\u6062\u590D\uFF09"
        );
        return true;
      } catch (e) {
        this.onLog("\u5F3A\u5236\u5E38\u4EAE\u8BBE\u7F6E\u5931\u8D25 " + (e?.message || e));
        return false;
      }
    }
    async restoreWirelessAwake() {
      const saved = this._awakeSaved ?? this._readAwakeStored();
      if (!this._awakeApplied && saved == null) return true;
      if (saved == null || !this.adb) {
        this.onLog(
          saved == null ? "\u672A\u80FD\u6062\u590D\u606F\u5C4F\u65F6\u95F4\uFF1A\u539F\u503C\u672A\u8BB0\u5F55\uFF08\u53EF\u80FD\u4E0A\u6B21\u9875\u9762\u88AB\u76F4\u63A5\u5173\u95ED\uFF09" : "\u672A\u80FD\u6062\u590D\u606F\u5C4F\u65F6\u95F4\uFF1AADB \u5DF2\u65AD\u5F00\uFF0C\u5FEB\u7167\u5DF2\u4FDD\u7559\uFF0C\u4E0B\u6B21\u8FDE\u63A5\u4F1A\u81EA\u52A8\u8865\u6062\u590D"
        );
        return false;
      }
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await this.deviceShell("settings put system screen_off_timeout " + saved, 6e3);
          await new Promise((resolve) => setTimeout(resolve, 300));
          const nowRaw = String(await this.deviceShell("settings get system screen_off_timeout", 6e3) || "").trim();
          const now = Number(nowRaw);
          if (Number.isFinite(now) && now === saved) {
            this._awakeApplied = false;
            this._awakeSaved = null;
            this._clearAwakeStored();
            this.onLog("\u5DF2\u6062\u590D\u624B\u673A\u606F\u5C4F\u65F6\u95F4 " + Math.round(saved / 1e3) + " \u79D2");
            return true;
          }
          this.onLog("\u6062\u590D\u606F\u5C4F\u65F6\u95F4\u6821\u9A8C\u4E0D\u4E00\u81F4\uFF08\u7B2C " + attempt + " \u6B21\uFF09\uFF1A\u671F\u671B " + saved + "\uFF0C\u5B9E\u9645 " + (nowRaw || "\u65E0\u56DE\u663E"));
        } catch (e) {
          this.onLog("\u6062\u590D\u606F\u5C4F\u65F6\u95F4\u5931\u8D25\uFF08\u7B2C " + attempt + " \u6B21\uFF09\uFF1A" + (e?.message || e));
        }
      }
      this.onLog("\u606F\u5C4F\u65F6\u95F4\u4ECD\u672A\u6062\u590D\uFF0C\u5DF2\u4FDD\u7559\u5FEB\u7167\uFF1B\u4E0B\u6B21\u8FDE\u63A5\u8BBE\u5907\u65F6\u4F1A\u81EA\u52A8\u8865\u6062\u590D");
      return false;
    }
    /**
     * 手机端看门狗（v4.0.12 起重新收敛为单一职责）：
     *
     *   无线会话失联  →  结束手机端 scrcpy、释放音频采集  →  自己退出
     *
     * 它不重连、不改用户的勿扰/音量设置、不猜网络状态。
     * 为什么必须由手机自己动手：手机主动关 Wi-Fi 时电脑根本连不上手机，
     * 任何远程清理都会失败；而断网后 scrcpy 的 socket 会被内核挂住十几分钟，
     * 进程不会自己退出、音频采集一直被占着 —— 这就是断网后手机长期没声音的根因。
     *
     * 判据只有两条（见文件顶部 GUARD_STALE 注释）：心跳过期、Wi-Fi 地址消失。
     * 布防只占一个 adb 往返（写脚本 → 语法校验 → 置一次心跳 → 起进程 → 回读运行标记），
     * 并且与 scrcpy 启动并行执行，不再拖慢连接。
     */
    async deployAudioGuard() {
      if (!this.adb) return false;
      const session = this._guardSession || (this._guardSession = newGuardSession());
      const body = this._guardScript(session);
      const bytes = new TextEncoder().encode(body);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const cmd = "echo '" + b64 + "' | base64 -d > " + GUARD_PATH + "; chmod 755 " + GUARD_PATH + " 2>/dev/null; sh -n " + GUARD_PATH + ' 2>/dev/null || { echo GUARD_SYNTAX_FAIL; exit 0; }; echo "$(date +%s) ' + session + '" > ' + guardHbPath(session) + "; ( nohup sh " + GUARD_PATH + " " + session + " </dev/null >/dev/null 2>&1 & ); ok=0; i=0; while [ $i -lt 8 ]; do now=$(date +%s); r=$(cat " + guardRunPath(session) + ' 2>/dev/null); r=${r%% *}; case "$r" in ""|*[!0-9]*) ;; *) if [ $((now-r)) -lt 25 ]; then ok=1; break; fi ;; esac; i=$((i+1)); sleep 0.3; done; if [ $ok -eq 1 ]; then echo GUARD_ALIVE; else echo GUARD_DEAD; fi; tail -n 2 ' + GUARD_LOG + " 2>/dev/null";
      const out = String(await this.deviceShell(cmd, 12e3) || "").trim();
      if (/GUARD_SYNTAX_FAIL/.test(out)) {
        this.onLog("\u770B\u95E8\u72D7\u811A\u672C\u8BED\u6CD5\u6821\u9A8C\u5931\u8D25\uFF0C\u5DF2\u8DF3\u8FC7\u5E03\u9632\uFF08\u4E0D\u5F71\u54CD\u672C\u8F6E\u6295\u5C4F\uFF09");
        return false;
      }
      const alive = /GUARD_ALIVE/.test(out);
      const tail = out.split(/\n/).map((l) => l.trim()).filter((l) => l.startsWith("[")).join(" | ");
      if (alive) {
        this.onLog(
          "\u770B\u95E8\u72D7\u5DF2\u5E03\u9632\uFF1A\u5FC3\u8DF3 5s/\u6B21\uFF0C\u5931\u8054\u8D85\u8FC7 " + GUARD_STALE + "s \u81EA\u52A8\u56DE\u6536 scrcpy" + (tail ? "\uFF1B\u624B\u673A\u65E5\u5FD7 " + tail : "")
        );
      } else {
        this.onLog("\u770B\u95E8\u72D7\u672A\u80FD\u542F\u52A8\u3002\u8BCA\u65AD\u56DE\u663E\uFF1A" + (out.replace(/\s*\n\s*/g, " | ") || "\u65E0\u8F93\u51FA"));
      }
      return alive;
    }
    /** 看门狗脚本正文（单独抽出来，方便本地仿真验证） */
    _guardScript(session) {
      const lines = [
        "#!/system/bin/sh",
        "# \u5355\u4E00\u804C\u8D23\uFF1A\u65E0\u7EBF\u4F1A\u8BDD\u5931\u8054 -> \u7ED3\u675F scrcpy\u3001\u91CA\u653E\u97F3\u9891\u91C7\u96C6 -> \u9000\u51FA\u3002",
        "# \u4E0D\u91CD\u8FDE\u3001\u4E0D\u6539\u52FF\u6270/\u97F3\u91CF\u3001\u4E0D\u731C\u7F51\u7EDC\uFF1B\u5224\u636E\u53EA\u6709\u300C\u5FC3\u8DF3\u8FC7\u671F\u300D\u4E0E\u300CWi-Fi \u5730\u5740\u6D88\u5931\u300D\u3002",
        'SESSION="' + session + '"',
        "HB=" + guardHbPath(session),
        "RUN=" + guardRunPath(session),
        "LOG=" + GUARD_LOG,
        "STALE=" + String(GUARD_STALE),
        "IDLE=" + String(GUARD_IDLE_EXIT),
        'log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }',
        'log "guard start session=$SESSION stale=${STALE}s"',
        "IFACE=$(ip link 2>/dev/null | sed -n 's/^[0-9]*: \\(wlan[^:]*\\):.*/\\1/p' | head -n 1)",
        'if [ -z "$IFACE" ]; then IFACE=wlan0; fi',
        "had_ip=0; lost=0; tick=0; hb_seen=0",
        "while :; do",
        "  now=$(date +%s)",
        "  tick=$((tick+1))",
        // 运行标记：第一轮立即写一次（宿主要靠它判断有没有起来），之后每 5 轮（约 10 秒）一次
        '  if [ "$tick" -le 1 ] || [ $((tick % 5)) -eq 0 ]; then echo "$now $SESSION" > "$RUN"; fi',
        '  hb=$(cat "$HB" 2>/dev/null)',
        "  hb_ts=${hb%% *}",
        "  hb_sess=${hb#* }",
        // 新会话接手：立刻退场，绝不动新会话的 scrcpy
        '  if [ -n "$hb_sess" ] && [ "$hb_sess" != "$hb" ] && [ "$hb_sess" != "$SESSION" ]; then',
        '    log "superseded by $hb_sess, exit"; exit 0',
        "  fi",
        '  case "$hb_ts" in ""|*[!0-9]*) hb_ts="";; esac',
        '  if [ -n "$hb_ts" ]; then hb_seen=1; fi',
        // Wi-Fi 地址消失是确定事实：连续 2 次（约 4 秒）即判定，不必等心跳过期
        '  if ip -4 addr show "$IFACE" 2>/dev/null | grep -q "inet "; then',
        "    had_ip=1; lost=0",
        "  else",
        '    [ "$had_ip" -eq 1 ] && lost=$((lost+1))',
        "  fi",
        '  dead=0; why=""',
        '  if [ "$lost" -ge 2 ]; then dead=1; why="wifi ip gone x$lost"; fi',
        '  if [ -n "$hb_ts" ]; then',
        "    age=$((now - hb_ts))",
        '    if [ "$age" -gt "$STALE" ]; then dead=1; why="heartbeat ${age}s stale"; fi',
        "  fi",
        // 布防前一定先写心跳：读不到就是异常（写失败 / 文件被清），按失联处理，别让手机哑着
        '  if [ "$hb_seen" -eq 0 ] && [ "$tick" -ge $((IDLE / 2)) ]; then dead=1; why="no heartbeat in ${IDLE}s"; fi',
        '  if [ "$dead" -eq 1 ]; then',
        '    log "session dead ($why) -> release scrcpy"',
        '    pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null',
        "    sleep 1",
        '    pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null',
        '    pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null',
        // 只做净音量不变的「路由刷新」：不动勿扰、不按键、不改用户音量
        "    " + AUDIO_ROUTE_CMD,
        '    remain=$(ps -A 2>/dev/null | grep -c "[c]om.genymobile.scrcpy")',
        '    log "released remain=$remain"',
        "    exit 0",
        "  fi",
        "  sleep 2",
        "done"
      ];
      return lines.join("\n");
    }
    async isAudioGuardAlive() {
      if (!this.adb || !this._guardSession) return false;
      const out = await this.deviceShell(
        "now=$(date +%s); r=$(cat " + guardRunPath(this._guardSession) + ' 2>/dev/null); r=${r%% *}; case "$r" in ""|*[!0-9]*) echo DEAD ;; *) [ $((now-r)) -lt 25 ] && echo ALIVE || echo DEAD ;; esac',
        5e3
      );
      return /ALIVE/.test(String(out || "").trim());
    }
    /** 读回手机端看门狗日志（末尾若干行），用于确认它有没有真的跑起来 */
    async readAudioGuardLog(lines = 8) {
      if (!this.adb) return "";
      const out = await this.deviceShell(
        "tail -n " + lines + " " + GUARD_LOG + " 2>/dev/null",
        5e3
      );
      return String(out || "").trim();
    }
    /** 给手机端看门狗喂心跳：写入「本地时间戳 + 会话号」，写成功即证明通道还活着 */
    async heartbeat() {
      if (!this.adb || !this._guardSession) return false;
      try {
        await this.deviceShell(
          'echo "$(date +%s) ' + this._guardSession + '" > ' + guardHbPath(this._guardSession),
          5e3
        );
        return true;
      } catch {
        return false;
      }
    }
    async stopAudioGuard() {
      if (!this.adb) return;
      await this.deviceShell(
        'pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; sleep 0.3; pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; true',
        5e3
      );
    }
    /**
     * 主动收尾（停止投屏 / 断线后仍能连上手机时）：看门狗退场 + scrcpy 结束 + 路由刷新。
     * 一次 shell 跑完，替换原来 stopAudioGuard → kill（含 2 次 sleep）→ refresh 的串行往返。
     */
    async releaseSessionOnDevice() {
      if (!this.adb) return false;
      this._guardSession = "";
      const out = String(
        await this.deviceShell(
          'pkill -TERM -f "[p]anda_guard.sh" 2>/dev/null; pkill -TERM -f "[c]om.genymobile.scrcpy" 2>/dev/null; sleep 0.45; pkill -9 -f "[p]anda_guard.sh" 2>/dev/null; pkill -9 -f "[c]om.genymobile.scrcpy" 2>/dev/null; pkill -9 -f "[a]pp_process.*scrcpy" 2>/dev/null; ' + AUDIO_ROUTE_CMD + `; echo "REMAIN=$(ps -A 2>/dev/null | grep -c '[c]om.genymobile.scrcpy')"`,
          15e3
        ) || ""
      );
      const remain = Number((/REMAIN=(\d+)/.exec(out) || [])[1] || 0);
      if (remain) this.onLog("\u624B\u673A\u7AEF scrcpy \u4ECD\u5728\u8FD0\u884C\uFF08" + remain + " \u4E2A\u8FDB\u7A0B\uFF09\uFF0C\u97F3\u9891\u53EF\u80FD\u4ECD\u88AB\u5360\u7528");
      return remain === 0;
    }
    /** 终止手机端 scrcpy 并刷新音频路由（它会占着音频采集，导致手机一直没声音） */
    async releaseScrcpyOnDevice() {
      if (!this.adb) return false;
      try {
        return await Promise.race([
          this.releaseSessionOnDevice(),
          new Promise((resolve) => setTimeout(() => resolve(false), 12e3))
        ]);
      } catch {
        return false;
      }
    }
    /**
     * 读取设备友好名称（用于状态页顶部展示）。
     * 优先 Xiaomi 的 marketname（如「Xiaomi 17 Pro」），否则「品牌 + 型号」。
     */
    async readDeviceName() {
      if (this._deviceLabel) return this._deviceLabel;
      const np = this.adb?.subprocess?.noneProtocol;
      if (!np) return "";
      const prop = async (key) => {
        try {
          return String(await np.spawnWaitText(["getprop", key]) || "").trim();
        } catch {
          return "";
        }
      };
      const brand = await prop("ro.product.brand");
      const model = await prop("ro.product.model");
      const market = await prop("ro.product.marketname");
      let label = market || [brand, model].filter(Boolean).join(" ");
      if (label && model && !label.toLowerCase().includes(String(model).toLowerCase())) {
        label += " " + model;
      }
      this._deviceLabel = label;
      return label;
    }
    /** 读取 Android API 等级（用于判断是否支持 audio-dup） */
    async getAndroidSdk() {
      if (this._sdk) return this._sdk;
      try {
        const txt = await this.adb.subprocess.noneProtocol.spawnWaitText([
          "getprop",
          "ro.build.version.sdk"
        ]);
        const n = parseInt(String(txt || "").trim(), 10);
        if (Number.isFinite(n) && n > 0) this._sdk = n;
      } catch {
      }
      return this._sdk || 0;
    }
    /** 无线意外断线后，短时间重连一次手机，把残留的 scrcpy 进程杀掉，恢复手机声音 */
    async restoreWirelessAudio() {
      const target = this._wirelessTarget;
      if (!target) return false;
      let conn = null;
      try {
        this.onLog("\u5C1D\u8BD5\u91CD\u8FDE\u624B\u673A\u91CA\u653E\u97F3\u9891\u2026");
        conn = await connectWireless(target, () => {
        });
        this.adb = conn.adb;
        const glog = await this.readAudioGuardLog(8);
        if (glog) this.onLog("\u770B\u95E8\u72D7\u65E5\u5FD7\uFF1A" + glog.replace(/\n/g, " | "));
        const ok = await this.releaseSessionOnDevice();
        await this.restoreWirelessAwake();
        this.onLog(ok ? "\u5DF2\u7ED3\u675F\u624B\u673A\u7AEF scrcpy \u5E76\u5237\u65B0\u97F3\u9891\u8DEF\u7531" : "\u672A\u80FD\u7ED3\u675F\u624B\u673A\u7AEF scrcpy\uFF0C\u97F3\u9891\u53EF\u80FD\u4ECD\u88AB\u5360\u7528");
        return ok;
      } catch (e) {
        this.onLog("\u6062\u590D\u5C1D\u8BD5\u5931\u8D25\uFF1A" + (e?.message || e));
        return false;
      } finally {
        try {
          await conn?.dispose();
        } catch {
        }
        this.adb = null;
      }
    }
    /** 无线链路心跳：真发一条 shell 命令，能立刻发现手机已断开（而不是等 TCP 超时） */
    async ping(timeoutMs = 4e3) {
      if (!this.adb?.subprocess?.noneProtocol) return false;
      try {
        return await Promise.race([
          this.adb.subprocess.noneProtocol.spawnWaitText(["true"]).then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
        ]);
      } catch {
        return false;
      }
    }
    /** 最近一次从手机收到数据的时间戳（ms）；0 = 无线链路不在/从未收到 */
    linkLastRecv() {
      const fn = this._wirelessLastRecv;
      if (typeof fn !== "function") return 0;
      try {
        const t = fn();
        return Number.isFinite(t) ? t : 0;
      } catch {
        return 0;
      }
    }
    /** 心跳判定链路已断：主动收尾，并尝试杀掉手机端 scrcpy、恢复手机声音 */
    async handleLinkLost() {
      if (this._stopRequested || !this.running) return;
      this._stopRequested = true;
      this._dropHandled = true;
      this.running = false;
      this.status("\u65E0\u7EBF\u94FE\u8DEF\u5DF2\u65AD\u5F00");
      try {
        await Promise.race([
          this.client?.close(),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      } catch {
      }
      this.client = null;
      await this.cleanupAfterDrop("\u65E0\u7EBF\u5FC3\u8DF3\u8D85\u65F6");
    }
    /** 手机短暂离线时，后台每隔几秒试着重新连上，一连上就清掉残留的 scrcpy */
    _scheduleLateCleanup() {
      const target = this._wirelessTarget;
      if (!target || this._lateActive) return;
      this._lateActive = true;
      let tries = 0;
      const tick = async () => {
        this._lateTimer = null;
        if (!this._lateActive || tries >= 20) {
          this._lateActive = false;
          return;
        }
        tries += 1;
        let conn = null;
        try {
          conn = await connectWireless(target, () => {
          });
          if (!this._lateActive || this.running) {
            this._lateActive = false;
            await conn.dispose();
            return;
          }
          this.adb = conn.adb;
          const glog = await this.readAudioGuardLog(8);
          if (glog) {
            this.onLog("\u770B\u95E8\u72D7\u65E5\u5FD7\uFF1A" + glog.replace(/\n/g, " | "));
          } else {
            this.onLog("\u770B\u95E8\u72D7\u672A\u7559\u4E0B\u65E5\u5FD7\uFF1A\u672C\u8F6E\u53EF\u80FD\u672A\u542F\u52A8\u6210\u529F\uFF08\u82E5\u65E5\u5FD7\u5E38\u51FA\u73B0\u6B64\u884C\u8BF7\u53CD\u9988\uFF09");
          }
          const ok = await this.releaseSessionOnDevice();
          this._lateActive = false;
          this.onLog(
            ok ? "\u624B\u673A\u5DF2\u91CD\u65B0\u4E0A\u7EBF\uFF0C\u5DF2\u7ED3\u675F\u6B8B\u7559 scrcpy \u5E76\u5237\u65B0\u97F3\u9891\u8DEF\u7531\uFF0C\u58F0\u97F3\u5E94\u5DF2\u6062\u590D" : "\u624B\u673A\u5DF2\u4E0A\u7EBF\u4F46\u672A\u80FD\u7ED3\u675F scrcpy\uFF0C\u8BF7\u70B9\u9876\u680F\u300C\u6062\u590D\u58F0\u97F3\u300D"
          );
          return;
        } catch {
        } finally {
          try {
            await conn?.dispose();
          } catch {
          }
          this.adb = null;
        }
        if (this._lateActive) this._lateTimer = setTimeout(tick, 6e3);
      };
      this._lateTimer = setTimeout(tick, 6e3);
    }
    /** 非用户主动停止的断线：停止播放 + 释放手机端音频占用 + 清掉舞台画面 */
    async cleanupAfterDrop(reason) {
      if (this._dropHandled || this._cleaned) return;
      this._dropHandled = true;
      this._cleaned = true;
      this.running = false;
      this.onLog("\u8FDE\u63A5\u4E2D\u65AD\u539F\u56E0\uFF1A" + reason);
      this._teardownRenderer();
      try {
        await this.audio?.stop();
      } catch {
      }
      this.audio = new AudioMirror();
      await this.restoreWirelessAwake();
      await this.releaseScrcpyOnDevice();
      if (this._wirelessTarget) {
        this.status("\u65E0\u7EBF\u5DF2\u65AD\u5F00\uFF0C\u6B63\u5728\u6062\u590D\u624B\u673A\u58F0\u97F3\u2026");
        const ok = await this.restoreWirelessAudio();
        await this.restoreWirelessAwake();
        if (ok) {
          this.onLog("\u624B\u673A\u58F0\u97F3\u5DF2\u6062\u590D");
        } else {
          this.onLog(
            "\u624B\u673A\u5DF2\u79BB\u7F51\uFF0C\u65E0\u6CD5\u8FDC\u7A0B\u6E05\u7406\uFF1A\u624B\u673A\u7AEF\u770B\u95E8\u72D7\u4F1A\u5728\u540E\u53F0\u7ED3\u675F scrcpy\uFF1B\u91CD\u65B0\u8054\u7F51\u540E\u82E5\u4ECD\u65E0\u58F0\uFF0C\u6309\u4E00\u6B21\u97F3\u91CF\u952E\u5373\u53EF"
          );
          this._scheduleLateCleanup();
        }
      }
      await this._runBeforeTeardown();
      try {
        await this.adb?.close();
      } catch {
      }
      this.adb = null;
      await this._closeUsbHandle();
      this.deviceController = null;
      this.status("\u5DF2\u65AD\u5F00");
    }
    async pushServerWireless(target) {
      this.onLog("\u901A\u8FC7\u672C\u5730\u5B98\u65B9 ADB \u4E0A\u4F20 scrcpy-server\u2026");
      const response = await fetch("/api/wireless-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new MirrorError(result.error || "\u65E0\u7EBF server \u4E0A\u4F20\u5931\u8D25", "SERVER_UPLOAD");
      }
      this._wirelessServerUploaded = target;
      this.onLog("scrcpy-server \u65E0\u7EBF\u4E0A\u4F20\u5B8C\u6210");
    }
    hasServerJarCache() {
      return this._usbServerBytes instanceof ArrayBuffer && this._usbServerBytes.byteLength > 0;
    }
    /** 页面就绪时提前缓存 jar，避免「服务先停止、用户再点连接」时没有兜底。 */
    prefetchServerJar() {
      if (this.hasServerJarCache()) return Promise.resolve(this._usbServerBytes);
      if (this._serverJarPrefetch) return this._serverJarPrefetch;
      this._serverJarPrefetch = this._readServerJar().then((buf) => {
        this.onLog(`\u5DF2\u9884\u7F13\u5B58 scrcpy-server.jar\uFF08${buf.byteLength} \u5B57\u8282\uFF09`);
        return buf;
      }).catch(() => null).finally(() => {
        this._serverJarPrefetch = null;
      });
      return this._serverJarPrefetch;
    }
    /**
     * 本地 HTTP 服务只在页面加载和 jar 下载时是强依赖。
     * 首次拿到 scrcpy-server.jar 后保留原字节，断线重连优先用缓存，
     * 避免「页面还活着、8765 已停止」时每次 ADB 认证成功却都卡在 Failed to fetch。
     */
    async _readServerJar() {
      const url = new URL(SERVER_URL, location.href).href;
      try {
        const resp = await fetch(url, { cache: "no-cache" });
        if (!resp.ok) {
          throw new MirrorError(`\u52A0\u8F7D scrcpy-server.jar \u5931\u8D25\uFF08HTTP ${resp.status}\uFF09`, "NO_SERVER");
        }
        const buf = await resp.arrayBuffer();
        if (!buf.byteLength) {
          throw new MirrorError("scrcpy-server.jar \u5185\u5BB9\u4E3A\u7A7A", "NO_SERVER");
        }
        this._usbServerBytes = buf;
        this._usbServerBytesAt = Date.now();
        return buf;
      } catch (err) {
        if (this.hasServerJarCache()) {
          const age = Math.round((Date.now() - this._usbServerBytesAt) / 1e3);
          this.onLog(
            `\u672C\u5730\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u6539\u7528\u5185\u5B58\u7F13\u5B58\u7684 scrcpy-server.jar\uFF08${this._usbServerBytes.byteLength} \u5B57\u8282\uFF0C\u7F13\u5B58 ${age} \u79D2\uFF09`
          );
          return this._usbServerBytes;
        }
        const reason = String(err?.message || err);
        if (/Failed to fetch|NetworkError|ERR_CONNECTION|HTTP \d+/i.test(reason)) {
          throw new MirrorError(
            `\u65E0\u6CD5\u4E0B\u8F7D scrcpy-server.jar\uFF0C\u4E14\u5F53\u524D\u6CA1\u6709\u5185\u5B58\u7F13\u5B58\u3002
\u672C\u5730\u670D\u52A1\u53EF\u80FD\u5DF2\u505C\u6B62\uFF0C\u8BF7\u91CD\u65B0\u542F\u52A8 scrcpy \u4FBF\u6377\u7F51\u9875\u7248\u540E\u5237\u65B0\u9875\u9762\u3002
\u76EE\u6807\uFF1A${url}`,
            "NO_SERVER",
            err
          );
        }
        throw new MirrorError("\u4E0B\u8F7D scrcpy-server.jar \u5931\u8D25\uFF1A" + reason, "NO_SERVER", err);
      }
    }
    async pushServer() {
      if (this._wirelessTarget) {
        if (this._wirelessServerUploaded !== this._wirelessTarget) {
          throw new MirrorError("\u65E0\u7EBF server \u5C1A\u672A\u5B8C\u6210\u9884\u4E0A\u4F20", "SERVER_UPLOAD");
        }
        return;
      }
      if (this._usbServerUploaded && this.device?.serial === this._usbServerUploaded) {
        return;
      }
      this.status("\u4E0A\u4F20 scrcpy-server\u2026");
      const buf = await this._readServerJar();
      const stream = new ReadableStream2({
        start(controller) {
          controller.enqueue(new Consumable(new Uint8Array(buf)));
          controller.close();
        }
      });
      await AdbScrcpyClient.pushServer(this.adb, stream);
    }
    _mountRenderer() {
      if (!this.stage) throw new MirrorError("\u7F3A\u5C11\u6E32\u67D3\u5BB9\u5668", "NO_STAGE");
      this._teardownRenderer();
      const { renderer, kind } = createRenderer();
      this.rendererKind = kind;
      this.pacedRenderer = new PacedRenderer(renderer, (this._opts || {}).maxFps, {
        takeArrival: () => this._pktArrivals.length ? this._pktArrivals.shift() : 0,
        onLatency: (ms) => {
          if (!Number.isFinite(ms) || ms < 0 || ms > 5e3) return;
          this._latencyMs = this._latencyMs == null ? ms : this._latencyMs * 0.7 + ms * 0.3;
        }
      });
      this.decoder = new WebCodecsVideoDecoder({
        codec: ScrcpyVideoCodecId.H264,
        renderer: this.pacedRenderer
      });
      const el = renderer.canvas;
      el.style.display = "block";
      el.style.touchAction = "none";
      el.style.cursor = "default";
      this.stage.appendChild(el);
      this.canvas = el;
    }
    /** 移除舞台上的旧画布并释放旧解码器（幂等，可重复调用） */
    _teardownRenderer() {
      try {
        this.decoder?.dispose();
      } catch {
      }
      this.decoder = null;
      this.pacedRenderer = null;
      try {
        this.stage.querySelectorAll("canvas").forEach((c) => c.remove());
      } catch {
      }
      this.canvas = null;
    }
    async startStream() {
      if (!this.adb) throw new MirrorError("ADB \u672A\u8FDE\u63A5", "NO_ADB");
      this._stopRequested = false;
      this._dropHandled = false;
      this._cleaned = false;
      this._diagLastPacketAt = 0;
      this._diagLastPacketKind = "";
      this._diagLastDecoderError = "";
      this._diagUsbEvent = "";
      if (this.client) {
        try {
          await Promise.race([
            this.client.close(),
            new Promise((resolve) => setTimeout(resolve, 1200))
          ]);
        } catch {
        }
        this.client = null;
      }
      const o = this._opts || {};
      let prep = { sdk: 0, remain: 0 };
      try {
        prep = await this.prepareDevice();
      } catch (e) {
        this.onLog("\u542F\u52A8\u524D\u6E05\u7406\u5F02\u5E38\uFF08\u4E0D\u5F71\u54CD\u7EE7\u7EED\u8FDE\u63A5\uFF09\uFF1A" + (e?.message || e));
      }
      const sdk = prep.sdk || await this.getAndroidSdk();
      const camMode = String(o.videoSource || "display").startsWith("camera");
      const audioMode = o.audioMode || "both";
      const wantDup = audioMode === "both";
      const wantAudio = audioMode !== "phone";
      const audioDup = wantDup && sdk >= 33 && !camMode;
      const audioOn = wantAudio && (camMode || audioDup || !wantDup);
      if (audioMode === "phone") {
        this.onLog("\u58F0\u97F3\u8F93\u51FA=\u4EC5\u624B\u673A\uFF1A\u4E0D\u8F6C\u53D1\u97F3\u9891\uFF0C\u624B\u673A\u4FDD\u6301\u539F\u6837\u51FA\u58F0\uFF0C\u7535\u8111\u7AEF\u9759\u97F3");
      } else if (audioMode === "pc") {
        this.onLog("\u58F0\u97F3\u8F93\u51FA=\u4EC5\u7535\u8111\uFF1A\u6295\u5C4F\u671F\u95F4\u624B\u673A\u4F1A\u9759\u97F3\uFF08scrcpy \u97F3\u9891\u5360\u7528\uFF09\uFF0C\u65AD\u5F00\u540E\u4F1A\u81EA\u52A8\u6062\u590D");
      } else if (wantDup && !camMode && !audioDup && sdk > 0) {
        this.onLog(
          "Android API " + sdk + " \u4E0D\u652F\u6301\u300C\u624B\u673A\u540C\u65F6\u5916\u653E\u300D(\u9700 Android 13+)\uFF1B\u5DF2\u6539\u4E3A\u4E0D\u8F6C\u53D1\u97F3\u9891\uFF0C\u624B\u673A\u58F0\u97F3\u4FDD\u6301\u6B63\u5E38"
        );
      }
      const guardTask = this._wirelessTarget ? this.deployAudioGuard().catch((e) => {
        this.onLog("\u770B\u95E8\u72D7\u5E03\u9632\u5F02\u5E38\uFF08\u4E0D\u5F71\u54CD\u6295\u5C4F\uFF09\uFF1A" + (e?.message || e));
        return false;
      }) : Promise.resolve(false);
      await this.pushServer();
      this._mountRenderer();
      this.status("\u542F\u52A8\u6295\u5C4F\u2026");
      const source = o.videoSource || "display";
      const isCam = String(source).startsWith("camera");
      const options = new AdbScrcpyOptions3_3_3({
        maxSize: Number.isFinite(o.maxSize) ? o.maxSize : 1280,
        // 0 = 原始分辨率
        videoBitRate: o.videoBitRate || 8e6,
        videoCodec: "h264",
        maxFps: Number.isFinite(o.maxFps) ? o.maxFps : 60,
        // 0 = 不限
        displayId: 0,
        powerOn: true,
        stayAwake: !!o.stayAwake,
        powerOffOnClose: !!o.powerOffOnClose,
        showTouches: !!o.showTouches,
        audio: audioOn,
        audioCodec: "raw",
        audioDup,
        control: true,
        logLevel: "debug",
        scid: InstanceId.random(),
        sendDeviceMeta: false,
        sendDummyByte: false,
        // scrcpy 5.0.1 将会话分辨率从编码器头中拆出；现有解码管线使用帧内 SPS 获取尺寸。
        sendCodecMeta: false,
        sendFrameMeta: true,
        videoCodecOptions: new CodecOptions(),
        tunnelForward: false,
        videoSource: isCam ? "camera" : "display"
      }, {
        // adb-scrcpy 从第二参数读取服务端版本；放错位置会仍按 3.3.3 启动。
        version: "5.0.1"
      });
      const serializeOptions = options.serialize.bind(options);
      options.serialize = () => serializeOptions().filter((line) => !line.startsWith("send_codec_meta=")).concat("send_stream_meta=false", "capture_orientation=0");
      if (isCam) {
        try {
          options.value.cameraId = source === "camera_front" ? "1" : "0";
          options.value.cameraFacing = source === "camera_front" ? "front" : "back";
        } catch {
        }
      }
      if (audioOn) {
        patchV5AudioMeta(options);
        this.onLog("\u5DF2\u5E94\u7528 scrcpy 5.x \u97F3\u9891\u6D41\u517C\u5BB9\u8865\u4E01\uFF08\u8DF3\u8FC7\u97F3\u9891 codec id \u9884\u8BFB\uFF09");
      }
      this.onLog(summarizeScrcpyOptions({
        serverVersion: options.version,
        maxSize: o.maxSize || 1280,
        fps: o.maxFps || 60,
        bitrate: o.videoBitRate,
        source,
        stayAwake: !!o.stayAwake,
        showTouches: !!o.showTouches,
        powerOffOnClose: !!o.powerOffOnClose,
        audioDup,
        audioOn,
        audioMode
      }));
      if (o.maxSize === 0 || o.maxFps === 0) {
        this.onLog("\u63D0\u793A\uFF1A\u539F\u59CB\u5206\u8FA8\u7387 / \u4E0D\u9650\u5E27\u7387\u5BF9\u89E3\u7801\u538B\u529B\u5F88\u5927\uFF0C\u82E5\u753B\u9762\u5361\u987F\u6216\u5F02\u5E38\u52A0\u901F\uFF0C\u5EFA\u8BAE\u6539\u56DE 1280 + 60fps + 8Mbps");
      }
      this.client = await AdbScrcpyClient.start(this.adb, DefaultServerPath, options);
      if (!this.client) throw new MirrorError("scrcpy \u5BA2\u6237\u7AEF\u542F\u52A8\u5931\u8D25", "SCRCPY_FAIL");
      if (this._wirelessTarget) {
        const guardReady = await guardTask;
        this.onLog(guardReady ? "\u770B\u95E8\u72D7\u5E03\u9632\u5B8C\u6210\uFF08\u4E0E\u542F\u52A8\u5E76\u884C\uFF0C\u4E0D\u5360\u8FDE\u63A5\u65F6\u95F4\uFF09" : "\u770B\u95E8\u72D7\u672A\u5E03\u9632\uFF0C\u65AD\u7F51\u65F6\u53EA\u80FD\u9760\u91CD\u8FDE\u540E\u6E05\u7406");
      }
      const logSink = (msg) => this.onLog(translateServerLine(String(msg)));
      this.client.output.pipeTo(
        new WritableStream({
          write(chunk) {
            console.debug("[scrcpy]", chunk);
            String(chunk).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => logSink(line));
          }
        })
      ).catch(() => {
      });
      const videoStream = await this.client.videoStream;
      if (!videoStream) throw new MirrorError("scrcpy \u672A\u8FD4\u56DE\u89C6\u9891\u6D41", "NO_VIDEO");
      await this.applyWirelessAwake();
      const { metadata, stream: packetStream } = videoStream;
      this._size = {
        width: metadata?.width || 0,
        height: metadata?.height || 0
      };
      this.deviceController = new DeviceController(this.client, {
        width: () => this._size.width,
        height: () => this._size.height
      }, this.adb);
      this.onController(this.deviceController, this.canvas);
      if (this._opts?.turnScreenOff) {
        try {
          await this.deviceController.screenOff();
          this.onLog("\u542F\u52A8\u540E\u5DF2\u5173\u95ED\u8BBE\u5907\u5C4F\u5E55");
        } catch (e) {
          this.onLog("\u5173\u95ED\u5C4F\u5E55\u5931\u8D25 " + (e?.message || e));
        }
      }
      if (!audioOn) {
        this.onStats({ ...this._stats(), audio: "\u672A\u8F6C\u53D1\uFF08\u624B\u673A\u539F\u6837\u51FA\u58F0\uFF09" });
      }
      try {
        if (audioOn && this.client.audioStream) {
          this.audio.onLog = (m) => this.onLog(String(m));
          const audioMeta = await this.client.audioStream;
          const audioResult = await this.audio.start(audioMeta);
          const modeZh = (m) => {
            const s = String(m || "");
            if (s.startsWith("pcm")) return "PCM \u539F\u59CB";
            if (s.startsWith("webcodecs:")) return "WebCodecs " + s.slice("webcodecs:".length).toUpperCase();
            return s || "\u672A\u77E5";
          };
          if (audioResult?.ok) {
            this.onStats({ ...this._stats(), audio: modeZh(audioResult.mode) });
            setTimeout(() => {
              const st = this.audio?.stats;
              this.onStats({
                ...this._stats(),
                audio: `\u97F3\u9891 ${modeZh(audioResult.mode)} \xB7 \u6536\u5305 ${st?.packets || 0} \xB7 \u7F13\u51B2 ${st?.bufferedMs != null ? st.bufferedMs + "ms" : "\u2014"} \xB7 \u6B20\u8F7D ${st?.underruns || 0} \xB7 \u524A\u51CF ${st?.dropped || 0}${st?.err && st.err !== "\u2014" ? " \xB7 \u5F02\u5E38 " + st.err : ""}`
              });
            }, 1500);
          } else {
            console.warn("[audio] skipped", audioResult?.reason);
            this.onStats({ ...this._stats(), audio: "\u65E0\u97F3\u9891:" + (audioResult?.reason || "") });
          }
        }
      } catch (e) {
        console.warn("[audio] start failed", e);
      }
      this.onStats(this._stats());
      let first = true;
      let h264ConfigSeen = false;
      const logPacketConfig = (msg) => this.onLog(msg);
      packetStream.pipeThrough(
        new TransformStream({
          transform(packet, controller) {
            if (packet?.type === "configuration") {
              h264ConfigSeen = true;
            } else if (!h264ConfigSeen && packet?.type === "data" && packet.keyframe) {
              const config = extractH264ParameterSets(packet.data);
              if (config) {
                controller.enqueue({ type: "configuration", data: config });
                logPacketConfig("\u5DF2\u4ECE\u9996\u4E2A\u5173\u952E\u5E27\u8865\u51FA H.264 \u914D\u7F6E\u5305");
                h264ConfigSeen = true;
                if (!h264HasSlice(packet.data)) {
                  logPacketConfig("\u9996\u4E2A\u7EAF\u53C2\u6570\u96C6\u5305\u5DF2\u8DF3\u8FC7\uFF0C\u7B49\u5F85\u771F\u6B63\u7684 IDR \u5E27");
                  return;
                }
              }
            }
            if (packet?.type === "data" && !packet.keyframe && h264HasIdr(packet.data)) {
              packet.keyframe = true;
            }
            controller.enqueue(packet);
          }
        })
      ).pipeThrough(
        new InspectStream((packet) => {
          this._diagLastPacketAt = Date.now();
          this._diagLastPacketKind = String(packet?.type || "") + (packet?.keyframe ? "/key" : "");
          try {
            if (packet?.type === "configuration") {
              const { croppedWidth, croppedHeight } = h264ParseConfiguration(packet.data);
              if (croppedWidth > 0 && croppedHeight > 0) {
                this._size = { width: croppedWidth, height: croppedHeight };
                this.onStats(this._stats());
              }
            } else if (packet?.type === "data") {
              this.frames += 1;
              this._pktArrivals.push(Date.now());
              if (this._pktArrivals.length > 150) this._pktArrivals.splice(0, this._pktArrivals.length - 150);
              if (!this._fpsWinStart) this._fpsWinStart = performance.now();
              this._fpsWinCount += 1;
              const winMs = performance.now() - this._fpsWinStart;
              if (winMs >= 500) {
                this._fps = (this._fpsWinCount * 1e3 / winMs).toFixed(1);
                this._fpsWinStart = performance.now();
                this._fpsWinCount = 0;
              }
              if (first) {
                first = false;
                this.onFirstFrame(this._size);
              }
              if (this.frames % 30 === 0) this.onStats(this._stats());
            }
          } catch (e) {
            console.warn("packet inspect", e);
          }
        })
      ).pipeTo(this.decoder.writable).catch((err) => {
        if (!this._stopRequested) {
          this._diagLastDecoderError = String(err?.name || "Error") + ": " + String(err?.message || err);
          console.error("video pipe", err);
          this.onError(err);
          this.cleanupAfterDrop("\u89C6\u9891\u89E3\u7801\u7BA1\u9053\u5F02\u5E38\uFF1A" + String(err?.message || err)).catch(() => {
          });
        }
      });
      this.running = true;
      this.startTs = performance.now();
      this.status("\u6295\u5C4F\u4E2D");
      this.onStats(this._stats());
      if (this._statsTimer) clearInterval(this._statsTimer);
      this._statsTimer = setInterval(() => {
        if (this.running) {
          try {
            this.onStats(this._stats());
          } catch {
          }
        }
      }, 500);
      this.client.exited.then(() => {
        const upSec = this.startTs ? Math.round((performance.now() - this.startTs) / 1e3) : 0;
        const lastAge = this._diagLastPacketAt ? Math.round((Date.now() - this._diagLastPacketAt) / 1e3) : -1;
        this.onLog(
          `\u63A7\u5236\u901A\u9053\u9000\u51FA \xB7 \u4E3B\u52A8\u505C\u6B62=${this._stopRequested ? "\u662F" : "\u5426"} \xB7 \u8FD0\u884C ${upSec}s \xB7 \u7D2F\u8BA1 ${this.frames} \u5E27 \xB7 \u6700\u540E\u4E00\u5E27\u89C6\u9891\u5305 ${lastAge >= 0 ? lastAge + "s \u524D\uFF08" + (this._diagLastPacketKind || "\u672A\u77E5") + "\uFF09" : "\u65E0"} \xB7 \u89E3\u7801\u9519\u8BEF ${this._diagLastDecoderError || "\u65E0"} \xB7 USB \u4E8B\u4EF6 ${this._diagUsbEvent || "\u65E0"}`
        );
        if (!this._stopRequested) {
          this.running = false;
          this.status("\u6295\u5C4F\u5DF2\u7ED3\u675F");
          this.cleanupAfterDrop("scrcpy \u63A7\u5236\u901A\u9053\u9000\u51FA").catch(() => {
          });
        }
      }).catch((e) => {
        const output = Array.isArray(e?.output) ? e.output.slice(-8).map((l) => translateServerLine(String(l))).join(" | ") : "";
        const reason = "\u63A7\u5236\u901A\u9053\u5F02\u5E38\uFF1A" + String(e?.name || "\u9519\u8BEF") + ": " + String(e?.message || e) + (output ? "\uFF1B\u670D\u52A1\u7AEF\u8F93\u51FA " + output : "");
        this.onLog(reason);
        if (!this._stopRequested) this.cleanupAfterDrop(reason).catch(() => {
        });
      });
      const watchChannel = (stream, channel) => {
        if (!stream?.closed) return;
        stream.closed.then(() => {
          if (!this._stopRequested) this.cleanupAfterDrop(channel + "\u5DF2\u5173\u95ED").catch(() => {
          });
        }).catch((e) => {
          const reason = channel + "\u5F02\u5E38\uFF1A" + String(e?.message || e);
          this.onLog(reason);
          if (!this._stopRequested) this.cleanupAfterDrop(reason).catch(() => {
          });
        });
      };
      watchChannel(this.videoStream, "\u89C6\u9891\u901A\u9053");
      watchChannel(this.audioStream, "\u97F3\u9891\u901A\u9053");
    }
    _stats() {
      const elapsed = (performance.now() - this.startTs) / 1e3;
      const avgFps = elapsed > 0 && this.frames ? (this.frames / elapsed).toFixed(1) : "0";
      return {
        frames: this.frames,
        fps: this._fps && this._fps !== "0" ? this._fps : avgFps,
        vdrop: this.pacedRenderer ? this.pacedRenderer.dropped : 0,
        width: this._size.width,
        height: this._size.height,
        latencyMs: this._latencyMs == null ? null : Math.round(this._latencyMs),
        audioLatency: this.audio?.latencyMs ?? null,
        running: this.running,
        renderer: this.rendererKind
      };
    }
    async snapshot() {
      if (this.decoder?.snapshot) {
        const blob = await this.decoder.snapshot();
        if (blob) return blob;
      }
      if (this.canvas?.toBlob) {
        return await new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), "image/png"));
      }
      return null;
    }
    async stop() {
      this._stopRequested = true;
      this._dropHandled = true;
      this._cleaned = true;
      this.running = false;
      if (this._statsTimer) {
        clearInterval(this._statsTimer);
        this._statsTimer = null;
      }
      if (this._lateTimer) {
        clearTimeout(this._lateTimer);
        this._lateTimer = null;
      }
      this._lateActive = false;
      await this.restoreWirelessAwake();
      await this._runBeforeTeardown();
      try {
        await this.deviceController?.dispose();
      } catch {
      }
      this.deviceController = null;
      try {
        await this.audio?.stop();
      } catch {
      }
      this.audio = new AudioMirror();
      try {
        await Promise.race([
          this.client?.close(),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      } catch {
      }
      this.client = null;
      this._teardownRenderer();
      try {
        if (this.adb) {
          await Promise.race([
            this.releaseSessionOnDevice(),
            new Promise((resolve) => setTimeout(resolve, 6e3))
          ]);
        }
      } catch {
      }
      await this.restoreWirelessAwake();
      try {
        await this.adb?.close();
      } catch {
      }
      try {
        await this._wirelessDispose?.();
      } catch {
      }
      this._wirelessDispose = null;
      this.adb = null;
      await this._closeUsbHandle();
      this.status("\u5DF2\u65AD\u5F00");
      this.onStats({ ...this._stats(), running: false });
    }
    /** 启动失败时释放 WebUSB / ADB / 解码器，避免页面自己把接口占住 */
    async _cleanupFailedStart() {
      try {
        await this.client?.close();
      } catch {
      }
      this.client = null;
      await this.restoreWirelessAwake();
      try {
        await this.adb?.close();
      } catch {
      }
      this.adb = null;
      await this._closeUsbHandle();
      try {
        await this.audio?.stop();
      } catch {
      }
      this.audio = new AudioMirror();
      this._teardownRenderer();
    }
    /** 一键 USB：选设备 → ADB 认证 → 投屏+控制+声音 */
    async start(preferSerial, opts, allowPicker = true) {
      if (this._starting) return;
      this._starting = true;
      try {
        this._opts = opts || {};
        this._preferSerial = preferSerial || "";
        this._wirelessTarget = "";
        this._wirelessLastRecv = null;
        this._wirelessServerUploaded = "";
        this._guardSession = "";
        await this.requestDevice(preferSerial, allowPicker, allowPicker ? 0 : 6e3);
        await this.connectAndAuth();
        if (!this._wirelessTarget && typeof navigator !== "undefined" && navigator.usb) {
          this._detachUsbDisconnect();
          this._usbDisconnectHandler = (event) => {
            if (event.device !== this.device?.raw) return;
            this._diagUsbEvent = "WebUSB disconnect @" + (/* @__PURE__ */ new Date()).toISOString();
            this.onLog("WebUSB \u7CFB\u7EDF\u4E8B\u4EF6\uFF1A\u8BBE\u5907\u8FDE\u63A5\u5DF2\u79FB\u9664\uFF08" + (this.device?.serial || "\u672A\u77E5\u5E8F\u5217\u53F7") + "\uFF09");
            void this.cleanupAfterDrop("Windows/WebUSB \u62A5\u544A\u8BBE\u5907\u8FDE\u63A5\u5DF2\u79FB\u9664");
          };
          navigator.usb.addEventListener("disconnect", this._usbDisconnectHandler);
        }
        await this.startStream();
      } catch (err) {
        await this._cleanupFailedStart();
        throw err;
      } finally {
        this._starting = false;
      }
    }
    /** 有线直连：本机官方 ADB → 投屏，浏览器不先弹 WebUSB 选择器 */
    async startUsbDirect(preferSerial, opts) {
      if (this._starting) return;
      this._starting = true;
      try {
        this._opts = opts || {};
        const info = await connectUsbDirect(preferSerial, (s) => this.status(s));
        this.adb = info.adb;
        this.device = {
          serial: info.serial,
          name: info.name || info.serial,
          rawDevice: null
        };
        this._usbDispose = info.dispose;
        this._wirelessTarget = "";
        this._guardSession = "";
        await prepareUsbServer(info.serial, (s) => this.status(s));
        this._usbServerUploaded = info.serial;
        await this.startStream();
      } finally {
        this._starting = false;
      }
    }
    /** 一键无线：IP:端口 → 本地 WS 桥 → ADB → 投屏 */
    async startWireless(target, opts) {
      if (this._starting) return;
      this._starting = true;
      const t0 = performance.now();
      try {
        this._opts = opts || {};
        this._wirelessTarget = target;
        this._wirelessServerUploaded = "";
        this._guardSession = "";
        this.status("\u65E0\u7EBF\u4E0A\u4F20\u4E2D\u2026");
        await this.pushServerWireless(target);
        const t1 = performance.now();
        this.status("\u65E0\u7EBF\u8FDE\u63A5\u4E2D\u2026");
        const { adb, dispose, lastRecv } = await connectWireless(target, (s) => this.status(s));
        const t2 = performance.now();
        this.adb = adb;
        this._wirelessDispose = dispose;
        this._wirelessLastRecv = lastRecv || null;
        this._wirelessTarget = target;
        this.device = {
          serial: target,
          name: `\u65E0\u7EBF ${target}`,
          rawDevice: null
        };
        await this.startStream();
        const t3 = performance.now();
        const sec = (from, to) => ((to - from) / 1e3).toFixed(1);
        this.onLog(
          `\u65E0\u7EBF\u8FDE\u63A5\u8017\u65F6 ${sec(t0, t3)}s\uFF08\u9884\u4E0A\u4F20 ${sec(t0, t1)}s / \u63E1\u624B ${sec(t1, t2)}s / \u542F\u52A8 ${sec(t2, t3)}s\uFF09`
        );
      } finally {
        this._starting = false;
      }
    }
    setMuted(muted) {
      this.muted = !!muted;
      this.audio?.setMuted(this.muted);
      return this.muted;
    }
    toggleMute() {
      return this.setMuted(!this.muted);
    }
  };

  // src/device-tools.js
  var DEFAULT_DIR = "/sdcard";
  function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }
  function normalizePath(input, base = DEFAULT_DIR) {
    let path = String(input == null ? "" : input).trim();
    if (!path) path = base;
    if (!path.startsWith("/")) path = (base.replace(/\/+$/, "") || "") + "/" + path;
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return path || "/";
  }
  function joinPath(dir, name) {
    const base = normalizePath(dir);
    const leaf = String(name == null ? "" : name).replace(/^\/+/, "");
    return normalizePath(base === "/" ? "/" + leaf : base + "/" + leaf);
  }
  function parentPath(path) {
    const p = normalizePath(path);
    if (p === "/" || p === "") return "/";
    const idx = p.lastIndexOf("/");
    return idx <= 0 ? "/" : p.slice(0, idx);
  }
  function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "\u2014";
    if (n < 1024) return n + " B";
    const units = ["KB", "MB", "GB", "TB"];
    let value = n / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + " " + units[unit];
  }
  function formatTime(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "";
    const d = new Date(n * 1e3);
    const pad = (v) => String(v).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fileKind(name) {
    const ext = String(name || "").split(".").pop().toLowerCase();
    if (!ext || ext === name) return "file";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"].includes(ext)) return "image";
    if (["mp4", "mkv", "mov", "avi", "webm", "3gp"].includes(ext)) return "video";
    if (["mp3", "flac", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
    if (["apk", "apks", "xapk"].includes(ext)) return "apk";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
    if (["txt", "md", "json", "xml", "log", "csv", "js", "html", "css", "py", "ts"].includes(ext)) return "text";
    return "file";
  }
  function parsePackageList(text) {
    const names = /* @__PURE__ */ new Set();
    String(text || "").split(/\r?\n/).forEach((line) => {
      const m = line.match(/^package:(\S+)\s*$/);
      if (m) names.add(m[1]);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }
  function mergePackages(all2, thirdParty) {
    const third = new Set(thirdParty || []);
    return (all2 || []).map((pkg) => ({ pkg, system: !third.has(pkg) })).sort((a, b) => Number(a.system) - Number(b.system) || a.pkg.localeCompare(b.pkg));
  }
  function filterPackages(list, { keyword = "", showSystem = false, scope = "" } = {}) {
    const kw = String(keyword || "").trim().toLowerCase();
    const mode2 = scope || (showSystem ? "all" : "third");
    return (list || []).filter((item) => {
      if (mode2 === "third" && item.system) return false;
      if (mode2 === "system" && !item.system) return false;
      if (!kw) return true;
      return item.pkg.toLowerCase().includes(kw) || String(item.label || "").toLowerCase().includes(kw);
    });
  }
  var withTimeout = (promise, ms, message) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || "\u64CD\u4F5C\u8D85\u65F6")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };
  var AdbShell = class {
    constructor(adb) {
      this.adb = adb || null;
    }
    get ready() {
      return !!this.adb?.subprocess?.noneProtocol;
    }
    async run(argv, timeoutMs = 2e4) {
      const sub = this.adb?.subprocess?.noneProtocol;
      if (!sub) throw new Error("ADB \u672A\u8FDE\u63A5");
      const output = await withTimeout(sub.spawnWaitText(argv), timeoutMs, "\u8BBE\u5907\u547D\u4EE4\u8D85\u65F6\uFF1A" + (argv || []).join(" "));
      return String(output == null ? "" : output);
    }
    sh(script, timeoutMs) {
      return this.run(["sh", "-c", shellQuote(script)], timeoutMs);
    }
  };
  var DeviceApps = class {
    constructor(adb) {
      this.shell = new AdbShell(adb);
    }
    get ready() {
      return this.shell.ready;
    }
    async list({ includeSystem = true } = {}) {
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      const [allOut, thirdOut] = await Promise.all([
        this.shell.run(["pm", "list", "packages"], 25e3),
        this.shell.run(["pm", "list", "packages", "-3"], 25e3)
      ]);
      return mergePackages(parsePackageList(allOut), parsePackageList(thirdOut)).filter(
        (item) => includeSystem || !item.system
      );
    }
    async start(pkg) {
      const out = await this.shell.run(["monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], 15e3);
      if (/No activities found|aborted|Error/i.test(out)) {
        throw new Error(out.split(/\r?\n/).filter(Boolean).pop() || "\u542F\u52A8\u5931\u8D25");
      }
      return out;
    }
    async forceStop(pkg) {
      return await this.shell.run(["am", "force-stop", pkg]);
    }
    async clearData(pkg) {
      const out = await this.shell.run(["pm", "clear", pkg], 2e4);
      if (!/success/i.test(out)) throw new Error(out.trim() || "\u6E05\u9664\u5931\u8D25");
      return out.trim();
    }
    async setEnabled(pkg, enabled = true) {
      const args = enabled ? ["pm", "enable", pkg] : ["pm", "disable-user", "--user", "0", pkg];
      const out = await this.shell.run(args, 2e4);
      if (!/new state:\s*(enabled|disabled)/i.test(out)) {
        throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "\u64CD\u4F5C\u5931\u8D25");
      }
      return out.trim();
    }
    async uninstall(pkg) {
      const out = await this.shell.run(["pm", "uninstall", "--user", "0", shellQuote(pkg)], 3e4);
      if (/Success/i.test(out)) return out.trim();
      const fallback = await this.shell.run(["pm", "uninstall", shellQuote(pkg)], 3e4);
      if (!/Success/i.test(fallback)) {
        throw new Error((fallback || out || "\u5378\u8F7D\u5931\u8D25").trim().split(/\r?\n/).pop());
      }
      return fallback.trim();
    }
    async detail(pkg) {
      const out = await this.shell.run(["dumpsys", "package", pkg], 25e3);
      const lines = out.split(/\r?\n/);
      const picked = [];
      const keys = [/versionName=/i, /versionCode=/i, /firstInstallTime=/i, /lastUpdateTime=/i, /targetSdk=/i, /minSdk=/i];
      for (const line of lines) {
        if (keys.some((re) => re.test(line))) picked.push(line.trim());
        if (picked.length >= 8) break;
      }
      return picked;
    }
    async install(file, onProgress) {
      return await this.installToPath(file, onProgress);
    }
    /** 先推到 /data/local/tmp 再 pm install */
    async installToPath(file, onProgress, options = {}) {
      const adb = this.shell.adb;
      if (!adb?.sync) throw new Error("ADB \u672A\u8FDE\u63A5");
      const remote = "/data/local/tmp/scrcpy-web-" + Date.now() + ".apk";
      const sync = await adb.sync();
      let sent = 0;
      try {
        const stream = file.stream().pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              sent += chunk.length;
              if (onProgress) onProgress({ phase: "push", sent, total: file.size });
              controller.enqueue(chunk);
            }
          })
        );
        await sync.write({ filename: remote, file: stream, ...options });
      } finally {
        try {
          await sync.dispose();
        } catch {
        }
      }
      if (onProgress) onProgress({ phase: "install", sent, total: file.size });
      const out = await this.shell.run(["pm", "install", "-r", "-t", shellQuote(remote)], 12e4);
      this.shell.run(["rm", "-f", shellQuote(remote)]).catch(() => {
      });
      if (!/Success/i.test(out)) {
        throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "\u5B89\u88C5\u5931\u8D25");
      }
      return out.trim();
    }
    /** 安装设备上已有的 APK */
    async installRemote(path) {
      const out = await this.shell.run(["pm", "install", "-r", "-t", shellQuote(normalizePath(path))], 12e4);
      if (!/Success/i.test(out)) {
        throw new Error(out.trim().split(/\r?\n/).filter(Boolean).pop() || "\u5B89\u88C5\u5931\u8D25");
      }
      return out.trim();
    }
  };
  var DeviceFiles = class {
    constructor(adb) {
      this.adb = adb || null;
      this.shell = new AdbShell(adb);
      this._sync = null;
    }
    get ready() {
      return !!this.adb?.sync && this.shell.ready;
    }
    async _open() {
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      if (!this._sync) this._sync = await this.adb.sync();
      return this._sync;
    }
    _drop() {
      const s = this._sync;
      this._sync = null;
      if (s) {
        try {
          s.dispose().catch(() => {
          });
        } catch {
        }
      }
    }
    async _withSync(fn) {
      const sync = await this._open();
      try {
        return await fn(sync);
      } catch (e) {
        this._drop();
        const retry = await this._open();
        return await fn(retry);
      }
    }
    async list(path) {
      const dir = normalizePath(path);
      const entries = await this._withSync((sync) => sync.readdir(dir));
      const mapped = entries.filter((entry) => entry.name !== "." && entry.name !== "..").map((entry) => ({
        name: entry.name,
        dir: Number(entry.type) === 4,
        link: Number(entry.type) === 10,
        size: Number(entry.size || 0),
        mtime: Number(entry.mtime || 0),
        path: joinPath(dir, entry.name),
        kind: Number(entry.type) === 4 ? "folder" : fileKind(entry.name)
      }));
      mapped.sort((a, b) => {
        if (a.dir !== b.dir) return a.dir ? -1 : 1;
        return a.name.localeCompare(b.name, "zh-Hans-CN");
      });
      return { path: dir, entries: mapped };
    }
    async stat(path) {
      return await this._withSync((sync) => sync.lstat(normalizePath(path)));
    }
    async readBlob(path, onProgress) {
      const target = normalizePath(path);
      const chunks = [];
      let received = 0;
      await this._withSync(async (sync) => {
        const stream = sync.read(target);
        const reader = stream.getReader();
        try {
          for (; ; ) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              if (onProgress) onProgress(received);
            }
          }
        } finally {
          try {
            reader.releaseLock();
          } catch {
          }
        }
      });
      return new Blob(chunks, { type: "application/octet-stream" });
    }
    async writeBlob(path, blob, onProgress, options = {}) {
      const target = normalizePath(path);
      let sent = 0;
      const file = blob.stream().pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            sent += chunk.length;
            if (onProgress) onProgress(sent, blob.size);
            controller.enqueue(chunk);
          }
        })
      );
      await this._withSync((sync) => sync.write({ filename: target, file, ...options }));
      return target;
    }
    async mkdir(path) {
      const out = await this.shell.run(["mkdir", "-p", shellQuote(normalizePath(path))]);
      return out.trim();
    }
    async remove(path, recursive = true) {
      const target = normalizePath(path);
      if (target === "/" || target === "/sdcard" || target === "/storage/emulated/0") {
        throw new Error("\u4E0D\u5141\u8BB8\u5220\u9664\u8BE5\u76EE\u5F55");
      }
      return await this.shell.run(["rm", "-" + (recursive ? "rf" : "f"), shellQuote(target)], 3e4);
    }
    async rename(from, to) {
      const src = normalizePath(from);
      const dst = normalizePath(to);
      const out = await this.shell.run(["mv", shellQuote(src), shellQuote(dst)], 3e4);
      return out.trim();
    }
    /**
     * v4.0.23 复制文件/文件夹。
     * 目标由调用方负责生成不冲突的名字；这里只拦“把目录复制进自身子目录”这类必然递归的错误。
     */
    async copy(from, to) {
      const src = normalizePath(from);
      const dst = normalizePath(to);
      if (src === "/" || src === "/sdcard" || src === "/storage/emulated/0") {
        throw new Error("\u4E0D\u5141\u8BB8\u590D\u5236\u8BE5\u76EE\u5F55");
      }
      if (src === dst) throw new Error("\u6E90\u548C\u76EE\u6807\u76F8\u540C");
      if (dst.startsWith(src.replace(/\/+$/, "") + "/")) {
        throw new Error("\u4E0D\u80FD\u628A\u6587\u4EF6\u5939\u590D\u5236\u5230\u5B83\u81EA\u5DF1\u7684\u5B50\u76EE\u5F55");
      }
      const out = await this.shell.run(["cp", "-R", shellQuote(src), shellQuote(dst)], 6e4);
      return out.trim();
    }
    async mediaScan(path) {
      const target = normalizePath(path);
      try {
        await this.shell.run([
          "am",
          "broadcast",
          "-a",
          "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
          "-d",
          shellQuote("file://" + target)
        ]);
      } catch {
      }
    }
  };

  // src/device-panel.js
  var FILE_ICONS = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 17l-5-5-9 9"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M11 9l5 3-5 3z"/>',
    audio: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    apk: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    archive: '<path d="M4 6h16v14H4z"/><path d="M4 6l2-2h12l2 2"/><path d="M12 9v6M9 12h6"/>',
    text: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>',
    file: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/>'
  };
  function iconOf(kind) {
    return '<svg viewBox="0 0 24 24">' + (FILE_ICONS[kind] || FILE_ICONS.file) + "</svg>";
  }
  function safeFilename(name) {
    return String(name || "download").replace(/[\\/:*?"<>|]/g, "_");
  }
  function bindDevicePanels({ getMirror, toast: toast2, log }) {
    const $2 = (id) => document.getElementById(id);
    let apps = null;
    let appsAdb = null;
    let appsCache = [];
    let appsBusy = false;
    let appMeta = /* @__PURE__ */ new Map();
    const appQueue = [];
    let appActive = 0;
    let appScrollBody = null;
    let appSelectMode = false;
    let appScope = "all";
    const appSelected = /* @__PURE__ */ new Set();
    let files = null;
    let filesAdb = null;
    let filesEntries = [];
    let filesPath = DEFAULT_DIR;
    let filesBusy = false;
    let fileSelectMode = false;
    let fileClipboard = [];
    const fileSelected = /* @__PURE__ */ new Set();
    const appsList = () => $2("app-list");
    const filesList = () => $2("file-list");
    function appsApi() {
      const adb = getMirror()?.adb;
      if (!adb) throw new Error("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
      if (!apps || appsAdb !== adb) {
        apps = new DeviceApps(adb);
        appsAdb = adb;
        appMeta = /* @__PURE__ */ new Map();
        appQueue.length = 0;
      }
      return apps;
    }
    function filesApi() {
      const adb = getMirror()?.adb;
      if (!adb) throw new Error("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
      if (!files || filesAdb !== adb) {
        files = new DeviceFiles(adb);
        filesAdb = adb;
      }
      return files;
    }
    function setAppsStatus(text) {
      const el = $2("apps-status");
      if (el) el.textContent = text;
    }
    function setFilesStatus(text) {
      const el = $2("files-status");
      if (el) el.textContent = text;
    }
    function appSerial() {
      const serial = getMirror()?.device?.serial;
      if (serial) return String(serial);
      const status = document.getElementById("stat-serial")?.textContent || "";
      return status.replace(/^设备\s*[:：]\s*/, "").trim();
    }
    function iconUrlOf(pkg, version) {
      return "/api/app-icon?serial=" + encodeURIComponent(appSerial()) + "&pkg=" + encodeURIComponent(pkg) + "&v=" + encodeURIComponent(String(version || ""));
    }
    function applyAppMeta(pkg) {
      const meta = appMeta.get(pkg);
      if (!meta) return;
      if (meta.name) {
        const item = appsCache.find((a) => a.pkg === pkg);
        if (item) item.label = meta.name;
      }
      document.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
        if (row.dataset.pkg !== pkg) return;
        const name = row.querySelector(".dev-name");
        if (name && meta.name) {
          name.textContent = meta.name;
          name.classList.remove("mono");
          name.classList.add("app-name");
        }
        const metaEl = row.querySelector(".dev-meta");
        if (metaEl && meta.name) {
          metaEl.textContent = pkg + (row.dataset.system === "1" ? " \xB7 \u7CFB\u7EDF\u5E94\u7528" : "");
          metaEl.classList.add("mono");
        }
        const avatar = row.querySelector(".dev-avatar");
        if (avatar && meta.iconUrl && !avatar.dataset.loaded) {
          avatar.dataset.loaded = "1";
          const img = document.createElement("img");
          img.alt = "";
          img.loading = "lazy";
          img.src = meta.iconUrl;
          img.addEventListener("error", () => {
            avatar.removeAttribute("data-loaded");
            img.remove();
          });
          avatar.replaceChildren(img);
        }
      });
    }
    async function fetchAppMeta(pkg) {
      const state = appMeta.get(pkg);
      if (state && (state.state === "loading" || state.state === "done")) return;
      appMeta.set(pkg, { name: "", iconUrl: "", state: "loading" });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12e3);
      try {
        const res = await fetch(
          "/api/app-meta?serial=" + encodeURIComponent(appSerial()) + "&pkg=" + encodeURIComponent(pkg),
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "\u8BFB\u53D6\u5E94\u7528\u4FE1\u606F\u5931\u8D25");
        const meta = {
          name: data.name || pkg,
          iconUrl: data.icon ? iconUrlOf(pkg, data.iconVersion) : "",
          state: "done"
        };
        appMeta.set(pkg, meta);
        applyAppMeta(pkg);
      } catch {
        appMeta.set(pkg, { name: "", iconUrl: "", state: "failed" });
        document.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
          if (row.dataset.pkg !== pkg) return;
          const metaEl = row.querySelector(".dev-meta");
          if (metaEl && metaEl.textContent === "\u8BFB\u53D6\u5E94\u7528\u4FE1\u606F\u2026") metaEl.textContent = pkg;
        });
      } finally {
        clearTimeout(timer);
      }
    }
    function pumpAppQueue() {
      while (appActive < 5 && appQueue.length) {
        const pkg = appQueue.shift();
        appActive += 1;
        fetchAppMeta(pkg).finally(() => {
          appActive -= 1;
          pumpAppQueue();
        });
      }
    }
    function enqueueAppMeta(pkg) {
      if (appMeta.has(pkg)) return;
      if (appQueue.includes(pkg)) return;
      appQueue.push(pkg);
      pumpAppQueue();
    }
    function loadVisibleAppRows() {
      const list2 = appsList();
      if (!list2) return;
      const body = list2.closest(".drawer-body") || list2;
      const box = body.getBoundingClientRect();
      list2.querySelectorAll(".dev-row[data-pkg]").forEach((row) => {
        const r = row.getBoundingClientRect();
        if (r.bottom > box.top - 200 && r.top < box.bottom + 200) enqueueAppMeta(row.dataset.pkg);
      });
    }
    function observeAppRows() {
      const list2 = appsList();
      if (!list2) return;
      const body = list2.closest(".drawer-body") || list2;
      if (appScrollBody !== body) {
        if (appScrollBody) appScrollBody.removeEventListener("scroll", loadVisibleAppRows);
        appScrollBody = body;
        body.addEventListener("scroll", loadVisibleAppRows, { passive: true });
      }
      loadVisibleAppRows();
    }
    function renderApps() {
      const list2 = appsList();
      if (!list2) return;
      const kw = $2("app-search")?.value || "";
      const items = filterPackages(appsCache, { keyword: kw, scope: appScope });
      list2.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "list-status";
        empty.textContent = appsCache.length ? "\u6CA1\u6709\u5339\u914D\u7684\u5E94\u7528" : "\u6682\u65E0\u5E94\u7528\uFF0C\u70B9\u53F3\u4E0A\u89D2\u300C\u5237\u65B0\u300D";
        list2.appendChild(empty);
        return;
      }
      const frag = document.createDocumentFragment();
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "dev-row";
        row.dataset.pkg = item.pkg;
        row.dataset.system = item.system ? "1" : "0";
        row.classList.toggle("is-picked", appSelected.has(item.pkg));
        if (appSelectMode) {
          const pick = document.createElement("span");
          pick.className = "dev-pick";
          pick.textContent = appSelected.has(item.pkg) ? "\u2713" : "";
          row.appendChild(pick);
        }
        const avatar = document.createElement("span");
        avatar.className = "dev-avatar app-avatar";
        const letter = document.createElement("span");
        letter.textContent = (item.pkg.split(".").pop() || "?").slice(0, 1);
        avatar.appendChild(letter);
        row.appendChild(avatar);
        const main = document.createElement("div");
        main.className = "dev-main";
        const name = document.createElement("span");
        name.className = "dev-name mono";
        name.textContent = item.pkg;
        name.title = "\u70B9\u51FB\u67E5\u770B\u7248\u672C\u4FE1\u606F";
        name.dataset.appDetail = item.pkg;
        const meta = document.createElement("span");
        meta.className = "dev-meta";
        meta.textContent = item.label ? item.pkg : "\u8BFB\u53D6\u5E94\u7528\u4FE1\u606F\u2026";
        main.append(name, meta);
        row.appendChild(main);
        const actions = document.createElement("div");
        actions.className = "dev-actions";
        const addBtn = (act, label, danger) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mini-btn" + (danger ? " danger" : "");
          b.dataset.appAct = act;
          b.dataset.pkg = item.pkg;
          b.textContent = label;
          actions.appendChild(b);
        };
        addBtn("start", "\u542F\u52A8");
        addBtn("stop", "\u505C\u6B62");
        if (!item.system) addBtn("uninstall", "\u5378\u8F7D", true);
        row.appendChild(actions);
        frag.appendChild(row);
      }
      list2.appendChild(frag);
      appMeta.forEach((meta, pkg) => {
        if (meta.state === "done") applyAppMeta(pkg);
      });
      observeAppRows();
    }
    function updateBatchBar() {
      const bar = $2("app-batch");
      if (!bar) return;
      bar.hidden = false;
      const count = $2("app-batch-count");
      if (count) count.textContent = "\u5DF2\u9009 " + appSelected.size + " \u9879";
      const canAct = appSelected.size > 0 && !appsBusy;
      const hasSystem = [...appSelected].some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system);
      document.querySelectorAll("#app-batch .batch-btn").forEach((btn) => {
        if (btn.dataset.batchAct === "done") return;
        if (btn.dataset.batchAct === "uninstall") {
          btn.disabled = !canAct || hasSystem;
          btn.title = hasSystem ? "\u7CFB\u7EDF\u5E94\u7528\u4E0D\u53EF\u5378\u8F7D" : "";
          return;
        }
        btn.disabled = !canAct;
      });
      const selectAllBtn = $2("btn-app-select-all");
      if (selectAllBtn) {
        selectAllBtn.disabled = !appSelectMode || !document.querySelectorAll("#app-list .dev-row").length;
        selectAllBtn.textContent = appSelected.size >= document.querySelectorAll("#app-list .dev-row").length && appSelected.size ? "\u5168\u4E0D\u9009" : "\u5168\u9009";
      }
    }
    function toggleAppPick(pkg, row) {
      if (appSelected.has(pkg)) appSelected.delete(pkg);
      else appSelected.add(pkg);
      const picked = appSelected.has(pkg);
      row?.classList.toggle("is-picked", picked);
      const pick = row?.querySelector(".dev-pick");
      if (pick) pick.textContent = picked ? "\u2713" : "";
      updateBatchBar();
    }
    function selectSingleApp(pkg, row) {
      appSelected.clear();
      appSelected.add(pkg);
      document.querySelectorAll("#app-list .dev-row[data-pkg]").forEach((r) => {
        const on2 = r === row || r.dataset.pkg === pkg;
        r.classList.toggle("is-picked", on2);
        const pick = r.querySelector(".dev-pick");
        if (pick) pick.textContent = on2 ? "\u2713" : "";
      });
      updateBatchBar();
    }
    function setAppSelectMode(on2) {
      appSelectMode = !!on2;
      if (!appSelectMode) appSelected.clear();
      const panel = $2("app-list")?.closest(".drawer");
      panel?.classList.toggle("is-selecting", appSelectMode);
      const btn = $2("btn-app-select");
      if (btn) {
        btn.textContent = appSelectMode ? "\u53D6\u6D88" : "\u591A\u9009";
        btn.classList.toggle("primary", appSelectMode);
        btn.classList.toggle("xs-btn", appSelectMode);
        btn.classList.toggle("ghost", !appSelectMode);
      }
      updateBatchBar();
      renderApps();
    }
    function selectAllApps(forceOff) {
      const rows = [...document.querySelectorAll("#app-list .dev-row[data-pkg]")];
      const allOn = rows.length > 0 && rows.every((row) => appSelected.has(row.dataset.pkg));
      const next = forceOff || allOn ? false : true;
      rows.forEach((row) => {
        const pkg = row.dataset.pkg;
        if (next) appSelected.add(pkg);
        else appSelected.delete(pkg);
        row.classList.toggle("is-picked", next);
        const pick = row.querySelector(".dev-pick");
        if (pick) pick.textContent = next ? "\u2713" : "";
      });
      updateBatchBar();
    }
    async function runAppBatch(action) {
      if (action === "done") {
        setAppSelectMode(false);
        return;
      }
      if (!appSelected.size) return;
      if (appsBusy) return toast2("\u8FD8\u6709\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C", "\u8BF7\u7A0D\u540E\u518D\u8BD5");
      const pkgs = [...appSelected];
      if (action === "uninstall" && pkgs.some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system)) {
        return toast2("\u7CFB\u7EDF\u5E94\u7528\u4E0D\u53EF\u5378\u8F7D", "\u8BF7\u5148\u53D6\u6D88\u52FE\u9009\u7CFB\u7EDF\u5E94\u7528\uFF0C\u518D\u6279\u91CF\u5378\u8F7D\u7B2C\u4E09\u65B9\u5E94\u7528", { duration: 8e3 });
      }
      const labelOf = {
        stop: "\u5F3A\u884C\u505C\u6B62",
        disable: "\u505C\u7528",
        enable: "\u542F\u7528",
        clear: "\u6E05\u9664\u6570\u636E",
        uninstall: "\u5378\u8F7D"
      };
      const label = labelOf[action] || action;
      if (action === "clear" || action === "uninstall") {
        const someSystem = pkgs.some((pkg) => appsCache.find((a) => a.pkg === pkg)?.system);
        const extra = someSystem ? "\n\u9009\u4E2D\u9879\u542B\u7CFB\u7EDF\u5E94\u7528\uFF0C\u53EF\u80FD\u5BFC\u81F4\u7CFB\u7EDF\u529F\u80FD\u5F02\u5E38\u3002" : "";
        const tail = action === "clear" ? "\u5E94\u7528\u6570\u636E\u4F1A\u5168\u90E8\u5220\u9664\u3002" : "\u5E94\u7528\u53CA\u5176\u6570\u636E\u4F1A\u88AB\u5220\u9664\u3002";
        if (!window.confirm("\u6279\u91CF" + label + " " + pkgs.length + " \u4E2A\u5E94\u7528\uFF1F\n" + tail + extra)) return;
      }
      appsBusy = true;
      updateBatchBar();
      const ok = [];
      const failed = [];
      try {
        const api = appsApi();
        for (let i = 0; i < pkgs.length; i++) {
          const pkg = pkgs[i];
          setAppsStatus("\u6279\u91CF" + label + " " + (i + 1) + "/" + pkgs.length + "\u2026");
          try {
            if (action === "stop") await api.forceStop(pkg);
            else if (action === "disable") await api.setEnabled(pkg, false);
            else if (action === "enable") await api.setEnabled(pkg, true);
            else if (action === "clear") await api.clearData(pkg);
            else if (action === "uninstall") await api.uninstall(pkg);
            else throw new Error("\u672A\u77E5\u64CD\u4F5C");
            ok.push(pkg);
            if (action === "uninstall") appsCache = appsCache.filter((a) => a.pkg !== pkg);
          } catch (e) {
            failed.push({ pkg, error: String(e?.message || e) });
          }
        }
      } finally {
        appsBusy = false;
        appSelected.clear();
        renderApps();
        updateBatchBar();
        const third = appsCache.filter((a) => !a.system).length;
        setAppsStatus("\u5171 " + appsCache.length + " \u4E2A\u5E94\u7528\uFF08\u7B2C\u4E09\u65B9 " + third + " \u4E2A\uFF09");
      }
      toast2(
        label + "\u5B8C\u6210",
        "\u6210\u529F " + ok.length + " \u4E2A" + (failed.length ? "\uFF0C\u5931\u8D25 " + failed.length + " \u4E2A" : ""),
        failed.length ? { duration: 9e3 } : void 0
      );
      log("ok", "\u6279\u91CF" + label + " \u6210\u529F " + ok.length + " \u4E2A");
      failed.forEach((f) => log("error", "\u6279\u91CF" + label + " \u5931\u8D25 " + f.pkg + "\uFF1A" + f.error));
      if (failed.length) setAppsStatus("\u6279\u91CF" + label + "\uFF1A" + failed.length + " \u4E2A\u5931\u8D25\uFF0C\u8BE6\u60C5\u89C1\u65E5\u5FD7");
    }
    async function refreshApps() {
      if (appsBusy) return;
      appsBusy = true;
      setAppsStatus("\u6B63\u5728\u8BFB\u53D6\u5E94\u7528\u5217\u8868\u2026");
      const refreshBtn = $2("btn-app-refresh");
      if (refreshBtn) refreshBtn.disabled = true;
      try {
        const api = appsApi();
        appsCache = await api.list({ includeSystem: true });
        for (const [pkg, meta] of appMeta) if (meta.state === "error" || meta.state === "failed") appMeta.delete(pkg);
        const third = appsCache.filter((a) => !a.system).length;
        setAppsStatus("\u5171 " + appsCache.length + " \u4E2A\u5E94\u7528\uFF08\u7B2C\u4E09\u65B9 " + third + " \u4E2A\uFF09");
        renderApps();
        log("info", "\u5E94\u7528\u5217\u8868 " + appsCache.length + " \u9879");
      } catch (e) {
        appsCache = [];
        renderApps();
        setAppsStatus(String(e?.message || e));
        toast2("\u8BFB\u53D6\u5E94\u7528\u5931\u8D25", String(e?.message || e));
        log("error", "\u8BFB\u53D6\u5E94\u7528\u5931\u8D25 " + String(e?.message || e));
      } finally {
        appsBusy = false;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }
    async function runAppAction(action, pkg, button) {
      if (appsBusy) return;
      if (action === "uninstall") {
        const item = appsCache.find((a) => a.pkg === pkg);
        if (item?.system) return toast2("\u7CFB\u7EDF\u5E94\u7528\u4E0D\u53EF\u5378\u8F7D", pkg + " \u5C5E\u4E8E\u7CFB\u7EDF\u5E94\u7528\uFF0C\u4E0D\u63D0\u4F9B\u5378\u8F7D\u64CD\u4F5C");
        const danger = "";
        if (!window.confirm("\u5378\u8F7D " + pkg + " \uFF1F\u5E94\u7528\u6570\u636E\u4F1A\u4E00\u8D77\u5220\u9664\u3002" + danger)) return;
      }
      appsBusy = true;
      if (button) button.disabled = true;
      try {
        const api = appsApi();
        if (action === "start") {
          await api.start(pkg);
          toast2("\u5DF2\u542F\u52A8", pkg);
        } else if (action === "stop") {
          await api.forceStop(pkg);
          toast2("\u5DF2\u5F3A\u5236\u505C\u6B62", pkg);
        } else if (action === "uninstall") {
          await api.uninstall(pkg);
          appsCache = appsCache.filter((a) => a.pkg !== pkg);
          renderApps();
          toast2("\u5DF2\u5378\u8F7D", pkg);
        }
        log("ok", "\u5E94\u7528 " + action + " " + pkg);
      } catch (e) {
        toast2("\u64CD\u4F5C\u5931\u8D25", String(e?.message || e));
        log("error", "\u5E94\u7528 " + action + " \u5931\u8D25 " + String(e?.message || e));
      } finally {
        appsBusy = false;
        if (button) button.disabled = false;
      }
    }
    async function showAppDetail(pkg) {
      try {
        const lines = await appsApi().detail(pkg);
        toast2(pkg, lines.length ? lines.join("\n") : "\u672A\u8BFB\u5230\u7248\u672C\u4FE1\u606F", { duration: 1e4 });
      } catch (e) {
        toast2("\u8BFB\u53D6\u8BE6\u60C5\u5931\u8D25", String(e?.message || e));
      }
    }
    async function installApk(file) {
      if (!file) return;
      if (appsBusy) return toast2("\u8FD8\u6709\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C", "\u8BF7\u7A0D\u540E\u518D\u8BD5");
      appsBusy = true;
      const btn = $2("btn-app-install");
      if (btn) btn.disabled = true;
      setAppsStatus("\u6B63\u5728\u63A8\u9001\u5230\u624B\u673A\u2026");
      let installed = false;
      try {
        const api = appsApi();
        log("info", "\u5F00\u59CB\u5B89\u88C5 " + file.name + " (" + formatSize(file.size) + ")");
        await api.install(file, (p) => {
          if (p.phase === "push") {
            const pct = p.total ? Math.round(p.sent / p.total * 100) : 0;
            setAppsStatus("\u6B63\u5728\u63A8\u9001\u5230\u624B\u673A\u2026 " + pct + "%");
          } else {
            setAppsStatus("\u6B63\u5728\u5B89\u88C5\uFF0C\u5927\u5305\u53EF\u80FD\u9700\u8981\u51E0\u5341\u79D2\u2026");
          }
        });
        installed = true;
        toast2("\u5B89\u88C5\u6210\u529F", file.name);
        log("ok", "\u5B89\u88C5\u6210\u529F " + file.name);
      } catch (e) {
        setAppsStatus("\u5B89\u88C5\u5931\u8D25\uFF1A" + String(e?.message || e));
        toast2("\u5B89\u88C5\u5931\u8D25", String(e?.message || e));
        log("error", "\u5B89\u88C5\u5931\u8D25 " + String(e?.message || e));
      } finally {
        appsBusy = false;
        if (btn) btn.disabled = false;
      }
      if (installed) await refreshApps();
    }
    function renderFiles() {
      const list2 = filesList();
      if (!list2) return;
      list2.replaceChildren();
      if (!filesEntries.length) {
        const empty = document.createElement("p");
        empty.className = "list-status";
        empty.textContent = "\u8FD9\u4E2A\u76EE\u5F55\u662F\u7A7A\u7684";
        list2.appendChild(empty);
        return;
      }
      const frag = document.createDocumentFragment();
      for (const entry of filesEntries) {
        const row = document.createElement("div");
        row.className = "dev-row" + (entry.dir ? " is-dir" : "");
        row.dataset.name = entry.name;
        row.dataset.path = entry.path;
        row.classList.toggle("is-picked", fileSelected.has(entry.path));
        if (fileSelectMode) {
          const pick = document.createElement("span");
          pick.className = "dev-pick";
          pick.textContent = fileSelected.has(entry.path) ? "\u2713" : "";
          row.appendChild(pick);
        }
        const avatar = document.createElement("span");
        avatar.className = "dev-avatar";
        avatar.innerHTML = iconOf(entry.dir ? "folder" : entry.kind);
        row.appendChild(avatar);
        const main = document.createElement("div");
        main.className = "dev-main";
        const name = document.createElement("span");
        name.className = "dev-name";
        name.textContent = entry.name + (entry.link ? " \u2197" : "");
        name.title = entry.path;
        const meta = document.createElement("span");
        meta.className = "dev-meta";
        meta.textContent = entry.dir ? "\u6587\u4EF6\u5939" : formatSize(entry.size) + (entry.mtime ? " \xB7 " + formatTime(entry.mtime) : "");
        main.append(name, meta);
        row.appendChild(main);
        const actions = document.createElement("div");
        actions.className = "dev-actions";
        if (!entry.dir && entry.kind === "apk") {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mini-btn";
          b.dataset.fileAct = "install";
          b.textContent = "\u5B89\u88C5";
          actions.appendChild(b);
        }
        if (!entry.dir) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mini-btn";
          b.dataset.fileAct = "download";
          b.textContent = "\u4E0B\u8F7D";
          actions.appendChild(b);
        }
        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "mini-btn";
        rename.dataset.fileAct = "rename";
        rename.textContent = "\u6539\u540D";
        actions.appendChild(rename);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "mini-btn danger";
        del.dataset.fileAct = "delete";
        del.textContent = "\u5220\u9664";
        actions.appendChild(del);
        row.appendChild(actions);
        frag.appendChild(row);
      }
      list2.appendChild(frag);
    }
    function fileKindLabel(entry) {
      if (entry.dir) return "\u6587\u4EF6\u5939";
      if (entry.link) return "\u7B26\u53F7\u94FE\u63A5";
      if (entry.kind === "apk") return "APK \u5B89\u88C5\u5305";
      const m = /\.([a-z0-9]{1,8})$/i.exec(entry.name || "");
      return m ? m[1].toUpperCase() + " \u6587\u4EF6" : "\u6587\u4EF6";
    }
    function fileMtimeText(entry) {
      if (!entry.mtime) return "\u672A\u77E5";
      const d = new Date(Number(entry.mtime) * 1e3);
      if (Number.isNaN(d.getTime())) return "\u672A\u77E5";
      return d.toLocaleString("zh-CN", { hour12: false });
    }
    function showFileDetail(entry) {
      const name = entry.name + (entry.link ? " \u2197" : "");
      const size = entry.dir ? "\u2014\uFF08\u6587\u4EF6\u5939\uFF09" : formatSize(entry.size) + "\uFF08" + Number(entry.size || 0).toLocaleString("zh-CN") + " \u5B57\u8282\uFF09";
      const lines = [
        "\u540D\u79F0\uFF1A" + name,
        "\u7C7B\u578B\uFF1A" + fileKindLabel(entry),
        "\u5927\u5C0F\uFF1A" + size,
        "\u4FEE\u6539\u65F6\u95F4\uFF1A" + fileMtimeText(entry),
        "\u8DEF\u5F84\uFF1A" + entry.path
      ];
      toast2("\u6587\u4EF6\u8BE6\u60C5", lines.join("\n"), { duration: 12e3 });
    }
    function updateFileBatchBar() {
      const bar = $2("file-batch");
      if (!bar) return;
      bar.hidden = false;
      const count = $2("file-batch-count");
      if (count) count.textContent = "\u5DF2\u9009 " + fileSelected.size + " \u9879";
      const selected = [...fileSelected];
      const one = selected.length === 1;
      const has = selected.length > 0 && !filesBusy;
      document.querySelectorAll("#file-batch .batch-btn").forEach((btn) => {
        const act = btn.dataset.fileBatchAct;
        if (act === "cancel") {
          btn.disabled = false;
          return;
        }
        if (act === "all") return;
        if (act === "detail") btn.disabled = !one || filesBusy;
        else if (act === "paste") btn.disabled = !fileClipboard.length || filesBusy;
        else btn.disabled = !has;
        if (act === "paste") btn.textContent = fileClipboard.length ? "\u7C98\u8D34 " + fileClipboard.length : "\u7C98\u8D34";
      });
      const selectAll = $2("btn-file-select-all");
      if (selectAll) {
        selectAll.disabled = !fileSelectMode || !filesEntries.length;
        selectAll.textContent = fileSelected.size >= filesEntries.length && fileSelected.size ? "\u5168\u4E0D\u9009" : "\u5168\u9009";
      }
    }
    function setFileSelectMode(on2) {
      fileSelectMode = !!on2;
      if (!fileSelectMode) fileSelected.clear();
      const panel = $2("file-list")?.closest(".drawer");
      panel?.classList.toggle("is-selecting", fileSelectMode);
      const btn = $2("btn-file-select");
      if (btn) {
        btn.textContent = fileSelectMode ? "\u53D6\u6D88" : "\u591A\u9009";
        btn.classList.toggle("primary", fileSelectMode);
        btn.classList.toggle("ghost", !fileSelectMode);
      }
      updateFileBatchBar();
      renderFiles();
    }
    function toggleFilePick(path, row) {
      if (fileSelected.has(path)) fileSelected.delete(path);
      else fileSelected.add(path);
      const picked = fileSelected.has(path);
      row?.classList.toggle("is-picked", picked);
      const pick = row?.querySelector(".dev-pick");
      if (pick) pick.textContent = picked ? "\u2713" : "";
      updateFileBatchBar();
    }
    function selectSingleFile(entry, row) {
      fileSelected.clear();
      fileSelected.add(entry.path);
      document.querySelectorAll("#file-list .dev-row[data-path]").forEach((r) => {
        const on2 = r === row || r.dataset.path === entry.path;
        r.classList.toggle("is-picked", on2);
        const pick = r.querySelector(".dev-pick");
        if (pick) pick.textContent = on2 ? "\u2713" : "";
      });
      updateFileBatchBar();
    }
    function selectAllFiles(forceOff = false) {
      const allOn = filesEntries.length > 0 && filesEntries.every((e) => fileSelected.has(e.path));
      const next = forceOff || allOn ? false : true;
      filesEntries.forEach((e) => {
        if (next) fileSelected.add(e.path);
        else fileSelected.delete(e.path);
      });
      document.querySelectorAll("#file-list .dev-row[data-path]").forEach((r) => {
        r.classList.toggle("is-picked", next);
        const pick = r.querySelector(".dev-pick");
        if (pick) pick.textContent = next ? "\u2713" : "";
      });
      updateFileBatchBar();
    }
    function uniqueCopyName(name, isDir, used) {
      if (!used.has(String(name).toLowerCase())) return name;
      const m = isDir ? null : /^(.*?)(\.[^.]+)?$/.exec(name);
      const base = m ? m[1] : name;
      const ext = m && m[2] ? m[2] : "";
      let i = 1;
      let candidate = name;
      do {
        candidate = base + (i === 1 ? " - \u526F\u672C" : " - \u526F\u672C (" + i + ")") + ext;
        i += 1;
      } while (used.has(candidate.toLowerCase()));
      return candidate;
    }
    async function copySelectedFiles() {
      if (!fileSelected.size || filesBusy) return;
      const entries = filesEntries.filter((e) => fileSelected.has(e.path));
      fileClipboard = entries.map((e) => ({ path: e.path, name: e.name, dir: !!e.dir }));
      setFileSelectMode(false);
      toast2("\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F", fileClipboard.map((e) => e.name).join("\u3001") + "\n\u5DF2\u7ED3\u675F\u672C\u6B21\u591A\u9009\uFF0C\u5207\u6362\u5230\u76EE\u6807\u6587\u4EF6\u5939\u540E\u70B9\u300C\u7C98\u8D34\u300D", {
        duration: 9e3
      });
      log("info", "\u6587\u4EF6\u526A\u8D34\u677F " + fileClipboard.length + " \u9879");
    }
    function cancelFileCopy() {
      const had = fileClipboard.length;
      fileClipboard = [];
      setFileSelectMode(false);
      if (had) {
        toast2("\u5DF2\u53D6\u6D88\u590D\u5236", "\u526A\u8D34\u677F\u5DF2\u6E05\u7A7A\uFF0C\u5171\u79FB\u9664 " + had + " \u9879");
        log("info", "\u53D6\u6D88\u6587\u4EF6\u590D\u5236\uFF0C\u6E05\u7A7A " + had + " \u9879");
      }
    }
    async function pasteClipboard() {
      if (!fileClipboard.length || filesBusy) return;
      const targetDir = filesPath;
      filesBusy = true;
      updateFileBatchBar();
      const ok = [];
      const failed = [];
      const used = new Set(filesEntries.map((e) => String(e.name).toLowerCase()));
      try {
        const api = filesApi();
        for (const item of fileClipboard) {
          const src = item.path;
          if (item.dir && (targetDir === src || targetDir.replace(/\/+$/, "").startsWith(src.replace(/\/+$/, "") + "/"))) {
            failed.push(item.name + "\uFF08\u4E0D\u80FD\u7C98\u8D34\u5230\u81EA\u8EAB\u5B50\u76EE\u5F55\uFF09");
            continue;
          }
          const next = uniqueCopyName(item.name, item.dir, used);
          const dst = joinPath(targetDir, next);
          setFilesStatus("\u6B63\u5728\u7C98\u8D34 " + item.name + " \u2192 " + next + " \u2026");
          try {
            await api.copy(src, dst);
            used.add(next.toLowerCase());
            ok.push(next);
          } catch (e) {
            failed.push(item.name + "\uFF08" + String(e?.message || e).slice(0, 80) + "\uFF09");
          }
        }
        await loadDir(targetDir, { silent: true, force: true });
        if (ok.length) {
          toast2("\u7C98\u8D34\u5B8C\u6210", ok.join("\u3001"), { duration: 7e3 });
          log("ok", "\u7C98\u8D34 " + ok.length + " \u9879\u5230 " + targetDir);
        }
        if (failed.length) {
          toast2("\u90E8\u5206\u7C98\u8D34\u5931\u8D25", failed.join("\n"), { duration: 12e3 });
          log("error", "\u7C98\u8D34\u5931\u8D25 " + failed.join(" | "));
        }
      } catch (e) {
        toast2("\u7C98\u8D34\u5931\u8D25", String(e?.message || e));
        log("error", "\u7C98\u8D34\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
        updateFileBatchBar();
      }
    }
    async function deleteSelectedFiles() {
      if (!fileSelected.size || filesBusy) return;
      const entries = filesEntries.filter((e) => fileSelected.has(e.path));
      if (!entries.length) return;
      const dirs = entries.filter((e) => e.dir).length;
      if (!window.confirm(
        "\u5220\u9664\u9009\u4E2D\u7684 " + entries.length + " \u9879\uFF1F" + (dirs ? "\n\u5176\u4E2D " + dirs + " \u4E2A\u6587\u4EF6\u5939\u4F1A\u8FDE\u540C\u5185\u90E8\u5185\u5BB9\u4E00\u8D77\u5220\u9664\u3002" : "") + "\n\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002"
      ))
        return;
      filesBusy = true;
      updateFileBatchBar();
      const ok = [];
      const failed = [];
      try {
        const api = filesApi();
        for (const entry of entries) {
          setFilesStatus("\u6B63\u5728\u5220\u9664 " + entry.name + " \u2026");
          try {
            await api.remove(entry.path, true);
            ok.push(entry.name);
          } catch (e) {
            failed.push(entry.name + "\uFF08" + String(e?.message || e).slice(0, 80) + "\uFF09");
          }
        }
        fileSelected.clear();
        await loadDir(filesPath, { silent: true, force: true });
        if (failed.length) {
          toast2("\u90E8\u5206\u5220\u9664\u5931\u8D25", failed.join("\n"), { duration: 12e3 });
          log("error", "\u6279\u91CF\u5220\u9664\u5931\u8D25 " + failed.join(" | "));
        } else {
          toast2("\u5DF2\u5220\u9664 " + ok.length + " \u9879", ok.join("\u3001"), { duration: 7e3 });
          log("ok", "\u6279\u91CF\u5220\u9664 " + ok.join("\u3001"));
        }
      } finally {
        filesBusy = false;
        updateFileBatchBar();
      }
    }
    async function runFileBatch(action) {
      if (action === "all") {
        selectAllFiles(false);
        return;
      }
      if (action === "cancel") {
        cancelFileCopy();
        return;
      }
      if (action === "detail") {
        const entry = filesEntries.find((e) => e.path === [...fileSelected][0]);
        if (entry) showFileDetail(entry);
        return;
      }
      if (action === "copy") return copySelectedFiles();
      if (action === "paste") return pasteClipboard();
      if (action === "delete") return deleteSelectedFiles();
    }
    function syncQuickChips() {
      document.querySelectorAll("#file-quick button").forEach((b) => {
        b.classList.toggle("active", normalizePath(b.dataset.path) === filesPath);
      });
    }
    async function loadDir(input, { silent = false, force = false } = {}) {
      if (filesBusy && !force) return;
      const target = normalizePath(input || filesPath || DEFAULT_DIR);
      if (fileSelectMode) setFileSelectMode(false);
      else fileSelected.clear();
      const prevBusy = filesBusy;
      filesBusy = true;
      setFilesStatus("\u6B63\u5728\u8BFB\u53D6 " + target + " \u2026");
      try {
        const api = filesApi();
        const result = await api.list(target);
        filesPath = result.path;
        filesEntries = result.entries;
        const box = $2("file-path");
        if (box) box.value = filesPath;
        renderFiles();
        updateFileBatchBar();
        syncQuickChips();
        setFilesStatus(filesEntries.length ? filesPath + " \xB7 " + filesEntries.length + " \u9879" : filesPath + " \xB7 \u7A7A\u76EE\u5F55");
        if (!silent) log("info", "\u6587\u4EF6\u76EE\u5F55 " + filesPath + " (" + filesEntries.length + " \u9879)");
      } catch (e) {
        setFilesStatus("\u8BFB\u53D6\u5931\u8D25\uFF1A" + String(e?.message || e));
        if (!silent) toast2("\u6253\u5F00\u76EE\u5F55\u5931\u8D25", String(e?.message || e));
        log("error", "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = prevBusy;
        updateFileBatchBar();
      }
    }
    function downloadBlob(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename(name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8e3);
    }
    async function downloadFile(entry) {
      if (filesBusy) return;
      filesBusy = true;
      setFilesStatus("\u6B63\u5728\u4E0B\u8F7D " + entry.name + " \u2026");
      try {
        const api = filesApi();
        const blob = await api.readBlob(entry.path, (n) => {
          if (entry.size) {
            setFilesStatus("\u6B63\u5728\u4E0B\u8F7D " + entry.name + " \u2026 " + Math.round(n / entry.size * 100) + "%");
          }
        });
        downloadBlob(blob, entry.name);
        toast2("\u5DF2\u4E0B\u8F7D\u5230\u7535\u8111", entry.name + " \xB7 " + formatSize(blob.size));
        log("ok", "\u4E0B\u8F7D " + entry.path + " (" + formatSize(blob.size) + ")");
        setFilesStatus(filesPath + " \xB7 " + filesEntries.length + " \u9879");
      } catch (e) {
        setFilesStatus("\u4E0B\u8F7D\u5931\u8D25\uFF1A" + String(e?.message || e));
        toast2("\u4E0B\u8F7D\u5931\u8D25", String(e?.message || e));
        log("error", "\u4E0B\u8F7D\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
      }
    }
    async function uploadFiles(fileList) {
      const items = Array.from(fileList || []);
      if (!items.length || filesBusy) return;
      filesBusy = true;
      try {
        const api = filesApi();
        for (const file of items) {
          if (/\.apk$/i.test(file.name)) {
            setFilesStatus("\u68C0\u6D4B\u5230 APK\uFF0C\u8F6C\u53BB\u5B89\u88C5\uFF1A" + file.name);
            await installApk(file);
            continue;
          }
          const target = joinPath(filesPath, file.name);
          setFilesStatus("\u6B63\u5728\u4E0A\u4F20 " + file.name + " \u2026");
          await api.writeBlob(target, file, (sent, total) => {
            const pct = total ? Math.round(sent / total * 100) : 0;
            setFilesStatus("\u6B63\u5728\u4E0A\u4F20 " + file.name + " \u2026 " + pct + "%");
          });
          await api.mediaScan(target);
          log("ok", "\u4E0A\u4F20 " + target + " (" + formatSize(file.size) + ")");
        }
        toast2("\u4E0A\u4F20\u5B8C\u6210", items.map((f) => f.name).join("\u3001"));
        await loadDir(filesPath, { silent: true, force: true });
      } catch (e) {
        setFilesStatus("\u4E0A\u4F20\u5931\u8D25\uFF1A" + String(e?.message || e));
        toast2("\u4E0A\u4F20\u5931\u8D25", String(e?.message || e));
        log("error", "\u4E0A\u4F20\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
      }
    }
    async function removeEntry(entry) {
      if (filesBusy) return;
      if (!window.confirm("\u5220\u9664" + (entry.dir ? "\u6587\u4EF6\u5939" : "\u6587\u4EF6") + " " + entry.name + " \uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002")) return;
      filesBusy = true;
      try {
        await filesApi().remove(entry.path, true);
        toast2("\u5DF2\u5220\u9664", entry.name);
        log("ok", "\u5220\u9664 " + entry.path);
        await loadDir(filesPath, { silent: true, force: true });
      } catch (e) {
        toast2("\u5220\u9664\u5931\u8D25", String(e?.message || e));
        log("error", "\u5220\u9664\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
      }
    }
    async function renameEntry(entry) {
      if (filesBusy) return;
      const next = window.prompt("\u91CD\u547D\u540D\u4E3A\uFF08\u53EA\u586B\u540D\u79F0\uFF09", entry.name);
      if (!next || next === entry.name) return;
      if (next.includes("/")) return toast2("\u540D\u79F0\u4E0D\u80FD\u5305\u542B /");
      filesBusy = true;
      try {
        await filesApi().rename(entry.path, joinPath(filesPath, next));
        toast2("\u5DF2\u91CD\u547D\u540D", next);
        log("ok", "\u91CD\u547D\u540D " + entry.path + " \u2192 " + next);
        await loadDir(filesPath, { silent: true, force: true });
      } catch (e) {
        toast2("\u91CD\u547D\u540D\u5931\u8D25", String(e?.message || e));
        log("error", "\u91CD\u547D\u540D\u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
      }
    }
    async function installFromDevice(entry) {
      if (filesBusy) return;
      if (!window.confirm("\u5728\u624B\u673A\u4E0A\u5B89\u88C5 " + entry.name + " \uFF1F")) return;
      filesBusy = true;
      setFilesStatus("\u6B63\u5728\u5B89\u88C5 " + entry.name + " \u2026");
      try {
        await appsApi().installRemote(entry.path);
        toast2("\u5B89\u88C5\u6210\u529F", entry.name);
        log("ok", "\u5B89\u88C5\u8BBE\u5907\u5185 APK " + entry.path);
        setFilesStatus(filesPath + " \xB7 " + filesEntries.length + " \u9879");
      } catch (e) {
        toast2("\u5B89\u88C5\u5931\u8D25", String(e?.message || e));
        setFilesStatus("\u5B89\u88C5\u5931\u8D25\uFF1A" + String(e?.message || e));
        log("error", "\u5B89\u88C5\u8BBE\u5907\u5185 APK \u5931\u8D25 " + String(e?.message || e));
      } finally {
        filesBusy = false;
      }
    }
    async function mkdirHere() {
      if (filesBusy) return;
      const name = window.prompt("\u65B0\u5EFA\u6587\u4EF6\u5939\u540D\u79F0", "\u65B0\u5EFA\u6587\u4EF6\u5939");
      if (!name) return;
      if (name.includes("/")) return toast2("\u540D\u79F0\u4E0D\u80FD\u5305\u542B /");
      try {
        await filesApi().mkdir(joinPath(filesPath, name));
        toast2("\u5DF2\u521B\u5EFA", name);
        await loadDir(filesPath, { silent: true, force: true });
      } catch (e) {
        toast2("\u521B\u5EFA\u5931\u8D25", String(e?.message || e));
      }
    }
    const list = appsList();
    if (list) {
      list.addEventListener("click", (e) => {
        if (appSelectMode) {
          const row2 = e.target.closest(".dev-row[data-pkg]");
          if (row2) {
            e.preventDefault();
            toggleAppPick(row2.dataset.pkg, row2);
          }
          return;
        }
        const btn = e.target.closest("button[data-app-act]");
        if (btn) {
          e.preventDefault();
          runAppAction(btn.dataset.appAct, btn.dataset.pkg, btn);
          return;
        }
        const row = e.target.closest(".dev-row[data-pkg]");
        if (row) {
          e.preventDefault();
          selectSingleApp(row.dataset.pkg, row);
        }
        const name = e.target.closest("[data-app-detail]");
        if (name) showAppDetail(name.dataset.appDetail);
      });
    }
    $2("btn-app-select")?.addEventListener("click", () => setAppSelectMode(!appSelectMode));
    $2("btn-app-select-all")?.addEventListener("click", () => selectAllApps(false));
    $2("app-batch")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-batch-act]");
      if (btn) runAppBatch(btn.dataset.batchAct);
    });
    $2("app-search")?.addEventListener("input", renderApps);
    document.querySelectorAll("#app-scope .scope-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        appScope = btn.dataset.scope || "all";
        appSelected.clear();
        document.querySelectorAll("#app-scope .scope-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        updateBatchBar();
        renderApps();
      });
    });
    $2("btn-app-refresh")?.addEventListener("click", () => refreshApps());
    $2("btn-app-install")?.addEventListener("click", () => $2("app-apk-input")?.click());
    const apkInput = $2("app-apk-input");
    apkInput?.addEventListener("change", async () => {
      const file = apkInput.files?.[0];
      apkInput.value = "";
      await installApk(file);
    });
    const filesBox = filesList();
    if (filesBox) {
      filesBox.addEventListener("click", async (e) => {
        const row = e.target.closest(".dev-row[data-path]");
        if (!row) return;
        const entry = filesEntries.find((item) => item.path === row.dataset.path);
        if (!entry) return;
        if (fileSelectMode) {
          e.preventDefault();
          toggleFilePick(entry.path, row);
          return;
        }
        const btn = e.target.closest("button[data-file-act]");
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          const act = btn.dataset.fileAct;
          if (act === "download") await downloadFile(entry);
          else if (act === "delete") await removeEntry(entry);
          else if (act === "rename") await renameEntry(entry);
          else if (act === "install") await installFromDevice(entry);
          return;
        }
        if (entry.dir) {
          await loadDir(entry.path);
          return;
        }
        selectSingleFile(entry, row);
        showFileDetail(entry);
      });
    }
    $2("btn-file-select")?.addEventListener("click", () => setFileSelectMode(!fileSelectMode));
    $2("file-batch")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-file-batch-act]");
      if (btn) runFileBatch(btn.dataset.fileBatchAct);
    });
    $2("btn-file-refresh")?.addEventListener("click", () => loadDir(filesPath));
    $2("btn-file-up")?.addEventListener("click", () => loadDir(parentPath(filesPath)));
    $2("btn-file-go")?.addEventListener("click", () => loadDir($2("file-path")?.value || DEFAULT_DIR));
    $2("file-path")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadDir($2("file-path")?.value || DEFAULT_DIR);
      }
    });
    $2("btn-file-upload")?.addEventListener("click", () => {
      if (!getMirror()?.adb) return toast2("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
      $2("file-upload")?.click();
    });
    $2("btn-file-newdir")?.addEventListener("click", mkdirHere);
    const uploadInput = $2("file-upload");
    uploadInput?.addEventListener("change", async () => {
      const picked = Array.from(uploadInput.files || []);
      uploadInput.value = "";
      await uploadFiles(picked);
    });
    document.querySelectorAll("#file-quick button").forEach((btn) => {
      btn.addEventListener("click", () => loadDir(btn.dataset.path));
    });
    const filesPanel = document.querySelector('[data-panel="files"]');
    if (filesPanel) {
      const over = (e) => {
        e.preventDefault();
        filesPanel.classList.add("is-drop");
      };
      const leave = () => filesPanel.classList.remove("is-drop");
      filesPanel.addEventListener("dragover", over);
      filesPanel.addEventListener("dragleave", leave);
      filesPanel.addEventListener("drop", async (e) => {
        e.preventDefault();
        leave();
        const dropped = Array.from(e.dataTransfer?.files || []);
        if (!dropped.length) return;
        await uploadFiles(dropped);
      });
    }
    const appsPanel = document.querySelector('[data-panel="apps"]');
    if (appsPanel) {
      const over = (e) => {
        e.preventDefault();
        appsPanel.classList.add("is-drop");
      };
      const leave = () => appsPanel.classList.remove("is-drop");
      appsPanel.addEventListener("dragover", over);
      appsPanel.addEventListener("dragleave", leave);
      appsPanel.addEventListener("drop", async (e) => {
        e.preventDefault();
        leave();
        const dropped = Array.from(e.dataTransfer?.files || []);
        const apk = dropped.find((f) => /\.apk$/i.test(f.name));
        if (apk) await installApk(apk);
        else if (dropped.length) toast2("\u8FD9\u91CC\u53EA\u63A5\u6536 APK", "\u5176\u4ED6\u6587\u4EF6\u8BF7\u62D6\u5230\u300C\u6587\u4EF6\u300D\u9762\u677F\u4E0A\u4F20");
      });
    }
    document.querySelectorAll('[data-drawer="apps"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!appsCache.length) refreshApps();
      });
    });
    document.querySelectorAll('[data-drawer="files"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!getMirror()?.adb) return setFilesStatus("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
        if (!filesEntries.length) loadDir(filesPath);
      });
    });
    setAppsStatus("\u8FDE\u63A5\u8BBE\u5907\u540E\u52A0\u8F7D");
    setFilesStatus("\u8FDE\u63A5\u8BBE\u5907\u540E\u52A0\u8F7D");
    if ($2("file-path")) $2("file-path").value = filesPath;
    if (location.search.includes("debug")) {
      window.__filesApi = filesApi;
      window.__appsApi = appsApi;
    }
    return {
      markDisconnected() {
        apps = null;
        appsAdb = null;
        appsCache = [];
        files = null;
        filesAdb = null;
        filesEntries = [];
        if (appsList()) appsList().replaceChildren();
        if (filesList()) filesList().replaceChildren();
        setAppsStatus("\u8BBE\u5907\u5DF2\u65AD\u5F00\uFF0C\u91CD\u65B0\u8FDE\u63A5\u540E\u70B9\u300C\u5237\u65B0\u300D");
        setFilesStatus("\u8BBE\u5907\u5DF2\u65AD\u5F00\uFF0C\u91CD\u65B0\u8FDE\u63A5\u540E\u70B9\u300C\u5237\u65B0\u300D");
      },
      notifyConnected() {
        setAppsStatus("\u5DF2\u8FDE\u63A5\uFF0C\u70B9\u300C\u5237\u65B0\u300D\u8BFB\u53D6\u5E94\u7528");
        setFilesStatus("\u5DF2\u8FDE\u63A5\uFF0C\u70B9\u300C\u5237\u65B0\u300D\u8BFB\u53D6\u6587\u4EF6");
      }
    };
  }

  // src/text-input.js
  var ADB_IME_PACKAGE = "com.android.adbkeyboard";
  var ADB_IME_ID = "com.android.adbkeyboard/.AdbIME";
  var ADB_APK_URL = "./assets/adbkeyboard/ADBKeyboard.apk";
  function hasNonAscii(text) {
    return /[^\x00-\x7f]/.test(String(text ?? ""));
  }
  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(String(text ?? ""));
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function imeListHas(output, id = ADB_IME_ID) {
    return String(output || "").split(/\r?\n/).map((line) => line.trim()).some((line) => line === id);
  }
  function packageListHas(output, pkg = ADB_IME_PACKAGE) {
    return String(output || "").split(/\r?\n/).some((line) => line.trim() === "package:" + pkg);
  }
  function parseCurrentIme(output) {
    const v = String(output || "").trim();
    if (!v || v === "null") return "";
    return v;
  }
  var PREV_IME_KEY = "scrcpy-prev-ime";
  function _prevKey(serial) {
    return serial ? PREV_IME_KEY + ":" + serial : PREV_IME_KEY;
  }
  function storePrevIme(serial, ime) {
    try {
      if (ime) localStorage.setItem(_prevKey(serial), ime);
      else localStorage.removeItem(_prevKey(serial));
    } catch {
    }
  }
  function readPrevIme(serial) {
    try {
      if (serial) {
        const v = localStorage.getItem(_prevKey(serial));
        if (v) return v;
      }
      return localStorage.getItem(PREV_IME_KEY) || "";
    } catch {
      return "";
    }
  }
  var DeviceTextInput = class {
    constructor(adb, serial = "") {
      this.adb = adb || null;
      this.serial = String(serial || "");
      this.shell = new AdbShell(adb);
      this.previousIme = "";
      this.active = false;
    }
    get ready() {
      return this.shell.ready;
    }
    async status() {
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      const installedOut = await this.shell.run(["pm", "list", "packages", ADB_IME_PACKAGE], 15e3);
      const listedOut = await this.shell.run(["ime", "list", "-s"], 15e3);
      const currentOut = await this.shell.run(["settings", "get", "secure", "default_input_method"], 1e4);
      const installed = packageListHas(installedOut, ADB_IME_PACKAGE);
      const enabled = imeListHas(listedOut, ADB_IME_ID);
      const current = parseCurrentIme(currentOut);
      return { installed, enabled, current, active: this.active && current === ADB_IME_ID };
    }
    async installFromBundle(blob, onProgress) {
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      const apps = new DeviceApps(this.adb);
      return await apps.install(blob, onProgress);
    }
    async fetchBundle() {
      const res = await fetch(ADB_APK_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("\u8BFB\u53D6\u8F93\u5165\u6CD5\u63D2\u4EF6\u5931\u8D25\uFF1A" + res.status);
      return await res.blob();
    }
    async enable() {
      const out = await this.shell.run(["ime", "enable", ADB_IME_ID], 15e3);
      if (/Error|Unknown/i.test(out)) throw new Error(out.trim());
      return out.trim();
    }
    /** 切到 ADB 输入法（记住原来的，便于恢复） */
    async activate() {
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      const current = parseCurrentIme(
        await this.shell.run(["settings", "get", "secure", "default_input_method"], 1e4)
      );
      if (current === ADB_IME_ID) {
        this.active = true;
        if (!this.previousIme) this.previousIme = readPrevIme(this.serial);
        return;
      }
      if (current) {
        this.previousIme = current;
        storePrevIme(this.serial, current);
      } else if (!this.previousIme) {
        this.previousIme = readPrevIme(this.serial);
      }
      const out = await this.shell.run(["ime", "set", ADB_IME_ID], 15e3);
      if (/Error|Unknown|not.*found/i.test(out)) throw new Error(out.trim());
      this.active = true;
    }
    /** 从已启用输入法列表里挑第一个非 ADB 输入法作为兜底恢复目标 */
    async pickFallbackIme() {
      const listed = await this.shell.run(["ime", "list", "-s"], 15e3);
      const ids = String(listed || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return ids.find((id) => id !== ADB_IME_ID) || "";
    }
    /** 恢复手机原来的输入法 */
    async restore() {
      if (!this.ready) {
        this.active = false;
        return "";
      }
      const current = parseCurrentIme(
        await this.shell.run(["settings", "get", "secure", "default_input_method"], 1e4)
      );
      if (current && current !== ADB_IME_ID) {
        this.active = false;
        this.previousIme = "";
        storePrevIme(this.serial, "");
        return "";
      }
      let prev = this.previousIme || readPrevIme(this.serial);
      this.active = false;
      if (!prev || prev === ADB_IME_ID) {
        prev = await this.pickFallbackIme();
      }
      if (!prev) {
        this.previousIme = "";
        storePrevIme(this.serial, "");
        return "";
      }
      try {
        await this.shell.run(["ime", "enable", prev], 15e3);
      } catch {
      }
      const out = await this.shell.run(["ime", "set", prev], 15e3);
      if (/Error|Unknown|not.*found/i.test(out)) throw new Error(out.trim());
      this.previousIme = "";
      storePrevIme(this.serial, "");
      return out.trim();
    }
    /** 发送整段文字（需先 activate） */
    async send(text) {
      const body = String(text ?? "");
      if (!body) return;
      if (!this.ready) throw new Error("ADB \u672A\u8FDE\u63A5");
      if (!this.active) await this.activate();
      const b64 = utf8ToBase64(body);
      const out = await this.shell.run(
        ["am", "broadcast", "-a", "ADB_INPUT_B64", "--es", "msg", b64],
        15e3
      );
      if (/Error/i.test(out)) throw new Error(out.trim());
      return out.trim();
    }
    /** 清空当前输入框内容（可选，用于「替换」场景） */
    async clearViaKeyevents(count) {
      const n = Math.max(0, Math.min(200, Number(count) || 0));
      if (!n) return;
      const seq = [];
      for (let i = 0; i < n; i += 1) seq.push("input keyevent 67");
      await this.shell.sh(seq.join("; "), 3e4);
    }
  };

  // src/page-mirror.js
  var SETTINGS_KEY = "pandatest-mirror-settings-v1";
  var IME_AUTO_KEY = "pandatest-ime-auto-v1";
  function $(id) {
    return document.getElementById(id);
  }
  function on(id, ev, fn) {
    const el = $(id);
    if (el) el.addEventListener(ev, fn);
    return el;
  }
  function all(sel) {
    return Array.from(document.querySelectorAll(sel));
  }
  var ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    recents: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>',
    power: '<path d="M12 3v10"/><path d="M7.5 6.5a8 8 0 1 0 9 0"/>',
    "vol-up": '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
    "vol-down": '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    "screen-on": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    "screen-off": '<path d="M3 3l18 18"/><circle cx="12" cy="12" r="4"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    notify: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    "notify-collapse": '<path d="M6 14s3-1 3-7a6 6 0 0 1 12 0"/><path d="M3 21h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/><circle cx="12" cy="12" r="8"/>',
    "phone-shot": '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
    "pc-shot": '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M9 11l2 2 4-4"/>',
    "rot-l": '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12H8"/>',
    "rot-0": '<rect x="7" y="3" width="10" height="18" rx="2"/>',
    "rot-r": '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h6"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    "fs-full": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  function iconSvg(act) {
    const d = ICONS[act];
    if (!d) return "";
    return '<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }
  function decorateIcons() {
    document.querySelectorAll("[data-act]").forEach((el) => {
      const act = el.getAttribute("data-act");
      if (!act || el.dataset.iconed === "1") return;
      const svg = iconSvg(act);
      if (svg) {
        el.classList.add("has-icon");
        const lbl = el.querySelector(".lbl3");
        const text = lbl ? lbl.outerHTML : "<span>" + el.textContent.trim() + "</span>";
        el.innerHTML = svg + text;
      }
      el.dataset.iconed = "1";
    });
  }
  function toast(title, description = "", opts = {}) {
    const root = $("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<div class="toast-body"><p class="toast-title"></p>' + (description ? '<p class="toast-desc"></p>' : "") + (opts.html || "") + "</div>";
    el.querySelector(".toast-title").textContent = title;
    if (description) el.querySelector(".toast-desc").textContent = description;
    while (root.children.length >= 3) root.firstElementChild?.remove();
    root.appendChild(el);
    const ttl = opts.duration || 4500;
    if (ttl > 0) setTimeout(() => el.remove(), ttl);
  }
  function shotToast(result) {
    const path = result?.path || "";
    const thumb = result?.thumb || "";
    const name = result?.name || path.split(/[\\/]/).pop() || "";
    const html = (thumb ? '<img class="shot-thumb" alt="thumb" src="' + thumb + '" />' : "") + '<div class="shot-actions"><button type="button" class="btn primary xs-btn" data-open-shot="' + String(path).replace(/"/g, "") + '">\u6253\u5F00\u6587\u4EF6</button></div>';
    toast("\u622A\u5C4F\u5DF2\u4FDD\u5B58", name, { html, duration: 12e3 });
    setTimeout(() => {
      document.querySelectorAll("[data-open-shot]").forEach((b) => {
        b.addEventListener("click", async () => {
          const p = b.getAttribute("data-open-shot");
          try {
            await fetch("/api/open-shot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: p })
            });
            toast("\u5DF2\u6253\u5F00\u6587\u4EF6\u4F4D\u7F6E", p);
          } catch (e) {
            toast("\u6253\u5F00\u5931\u8D25", String(e?.message || e));
          }
        });
      });
    }, 0);
    logLine("ok", "\u622A\u5C4F " + path);
  }
  var _logLast = { text: "", node: null, count: 1, at: 0 };
  function logLine(level, msg) {
    const box = $("log-box");
    const time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    const lines = String(msg == null ? "" : msg).split(/\r?\n/).map((l) => translateServerLine(l)).filter((l) => l);
    if (!lines.length) return;
    for (const one of lines) {
      const text = "[" + time + "] " + one;
      if (!box) {
        console.log(text);
        continue;
      }
      const now = Date.now();
      if (_logLast.node && _logLast.text === one && now - _logLast.at < 15e3) {
        _logLast.count += 1;
        _logLast.at = now;
        _logLast.node.textContent = "[" + time + "] " + one + "\uFF08\u91CD\u590D " + _logLast.count + " \u6B21\uFF09";
        continue;
      }
      const line = document.createElement("div");
      line.className = "log-line " + level;
      line.textContent = text;
      line.title = text;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
      _logLast = { text: one, node: line, count: 1, at: now };
      while (box.childNodes.length > 400) box.removeChild(box.firstChild);
    }
  }
  async function refreshDeviceBanner() {
    const nameEl = $("dev-name");
    if (!nameEl || nameEl.dataset.filled === "1") return;
    try {
      const label = await mirror?.readDeviceName?.();
      if (label) {
        nameEl.textContent = label;
        nameEl.dataset.filled = "1";
        nameEl.title = label;
      }
    } catch {
    }
  }
  function setStepsDone(count) {
    all(".steps").forEach((list) => {
      list.querySelectorAll(".step").forEach((s, i) => {
        s.classList.toggle("done", i < count);
      });
    });
  }
  function numOr(val, fallback) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  function collectOptions() {
    const maxSize = numOr($("opt-res")?.value, 1280);
    const maxFps = numOr($("opt-fps")?.value, 60);
    return {
      maxSize,
      maxFps,
      videoBitRate: Math.round((parseFloat($("opt-bitrate")?.value || "8") || 8) * 1e6),
      stayAwake: !!$("opt-awake")?.checked,
      turnScreenOff: !!$("opt-screen-off-start")?.checked,
      powerOffOnClose: !!$("opt-screen-off-close")?.checked,
      showTouches: !!$("opt-show-touches")?.checked,
      // 三态：both=手机+电脑 / phone=仅手机(不转发) / pc=仅电脑(手机静音)
      audioMode: $("opt-audio-mode")?.value || "both",
      videoSource: $("opt-source")?.value || "display"
    };
  }
  function saveSettings() {
    try {
      const data = {
        mode,
        host: $("wireless-host")?.value || "",
        device: $("usb-device-select")?.value || "",
        opts: collectOptions()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch {
    }
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  var savedDeviceSerial = "";
  function applySettings(data) {
    if (!data) return;
    if (data.mode === "wifi" || data.mode === "usb") setMode(data.mode, true);
    if (data.host && $("wireless-host")) $("wireless-host").value = data.host;
    savedDeviceSerial = data.device || "";
    const o = data.opts || {};
    const setSel = (id, v) => {
      const el = $(id);
      if (el && v != null && v !== "") el.value = String(v);
    };
    setSel("opt-res", o.maxSize != null ? String(o.maxSize) : "1280");
    setSel("opt-fps", o.maxFps != null ? String(o.maxFps) : "60");
    const mbps = o.videoBitRate ? Math.round(o.videoBitRate / 1e6) : 8;
    setSel("opt-bitrate", mbps);
    setSel("opt-source", o.videoSource || "display");
    const setChk = (id, v, def) => {
      const el = $(id);
      if (el) el.checked = v != null ? !!v : def;
    };
    setChk("opt-awake", o.stayAwake, true);
    setChk("opt-screen-off-start", o.turnScreenOff, false);
    setChk("opt-screen-off-close", o.powerOffOnClose, true);
    setChk("opt-show-touches", o.showTouches, false);
    setSel("opt-audio-mode", o.audioMode || "both");
  }
  function bindSettingsSaver() {
    const ids = [
      "opt-res",
      "opt-fps",
      "opt-bitrate",
      "opt-source",
      "opt-awake",
      "opt-screen-off-start",
      "opt-screen-off-close",
      "opt-show-touches",
      "opt-audio-mode",
      "wireless-host"
    ];
    ids.forEach((id) => {
      on(id, "change", saveSettings);
      on(id, "input", () => {
        clearTimeout(bindSettingsSaver._t);
        bindSettingsSaver._t = setTimeout(saveSettings, 300);
      });
    });
  }
  function scheduleUsbReconnect(reason) {
    if (mode !== "usb" || usbManualStop || usbStarting) return;
    const delays = [1500, 2500, 4e3, 6500, 1e4, 15e3];
    if (usbAutoRetries >= delays.length) {
      logLine("error", "USB \u81EA\u52A8\u91CD\u8FDE\u5DF2\u5C1D\u8BD5 " + delays.length + " \u6B21\u4ECD\u672A\u6062\u590D\uFF0C\u8BF7\u68C0\u67E5\u7EBF\u6750\u3001\u63A5\u53E3\u5360\u7528\u540E\u70B9\u300C\u91CD\u65B0\u8FDE\u63A5\u300D");
      toast("USB \u6682\u672A\u6062\u590D", "\u81EA\u52A8\u91CD\u8FDE\u5DF2\u6682\u505C\uFF0C\u53EF\u624B\u52A8\u70B9\u91CD\u65B0\u8FDE\u63A5");
      return;
    }
    const attempt = ++usbAutoRetries;
    const delay2 = delays[attempt - 1];
    clearTimeout(usbRetryTimer);
    toast("USB \u94FE\u8DEF\u4E2D\u65AD", "\u6B63\u5728\u81EA\u52A8\u91CD\u8FDE\uFF08" + attempt + "/" + delays.length + "\uFF09");
    logLine("warn", "USB \u94FE\u8DEF\u4E2D\u65AD\uFF08" + reason + "\uFF09\uFF0C" + delay2 / 1e3 + " \u79D2\u540E\u81EA\u52A8\u91CD\u8FDE " + attempt + "/" + delays.length);
    usbRetryTimer = setTimeout(() => {
      usbRetryTimer = null;
      if (!usbManualStop) startUsb(true, true);
    }, delay2);
  }
  var usbGuardWorker = null;
  var usbGuardFallback = null;
  var usbGuardBusy = false;
  function stopUsbGuard() {
    if (usbGuardFallback) clearInterval(usbGuardFallback);
    usbGuardFallback = null;
    if (usbGuardWorker) {
      try {
        usbGuardWorker.postMessage("stop");
        usbGuardWorker.terminate();
      } catch {
      }
    }
    usbGuardWorker = null;
    usbGuardBusy = false;
  }
  async function guardUsbExclusive() {
    if (usbGuardBusy || mode !== "usb" || !mirror.running && !usbStarting || usbManualStop) return;
    usbGuardBusy = true;
    try {
      const response = await fetch("/api/kill-adb", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (result.changed) logLine("warn", "\u68C0\u6D4B\u5230\u5916\u90E8 ADB \u670D\u52A1\u62A2\u5360\u98CE\u9669\uFF0C\u5DF2\u91CA\u653E\u5E76\u6062\u590D WebUSB \u72EC\u5360");
    } catch {
    } finally {
      usbGuardBusy = false;
    }
  }
  function startUsbGuard() {
    stopUsbGuard();
    try {
      const code = "let t=null;onmessage=function(e){if(e.data==='start'){if(t)clearInterval(t);t=setInterval(function(){postMessage(1)},2000)}else if(e.data==='stop'){if(t)clearInterval(t);t=null}};";
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      usbGuardWorker = new Worker(url);
      usbGuardWorker.onmessage = () => guardUsbExclusive();
      usbGuardWorker.postMessage("start");
    } catch {
      usbGuardFallback = setInterval(() => guardUsbExclusive(), 2e3);
    }
    logLine("info", "USB \u72EC\u5360\u4FDD\u62A4\u5DF2\u542F\u52A8\uFF082 \u79D2\u63A2\u6D4B\uFF0C\u4E0D\u4E3B\u52A8\u62C9\u8D77 ADB\uFF09");
  }
  var ctrl = null;
  var _canvasAbort = null;
  var _keyboardAbort = null;
  var mode = "usb";
  var wifiKeepAlive = null;
  var usbManualStop = false;
  var usbStarting = false;
  var usbConnectedAt = 0;
  var usbAutoRetries = 0;
  var usbRetryTimer = null;
  var usbStableTimer = null;
  function setMode(next, silent) {
    mode = next === "wifi" ? "wifi" : "usb";
    if (mode !== "usb") {
      stopUsbGuard();
      clearTimeout(usbStableTimer);
    }
    all(".mode-card").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
    all(".usb-only").forEach((el) => {
      el.hidden = mode !== "usb";
    });
    all(".wifi-only").forEach((el) => {
      el.hidden = mode !== "wifi";
    });
    if (!silent) {
      logLine("info", "\u8FDE\u63A5\u6A21\u5F0F=" + (mode === "usb" ? "USB" : "\u65E0\u7EBF"));
      saveSettings();
    }
  }
  function setMuteUi(m) {
    const span = $("btn-mute")?.querySelector("span");
    if (span) span.textContent = m ? "\u9759\u97F3\u4E2D" : "\u58F0\u97F3";
    if ($("audio-hint")) $("audio-hint").textContent = m ? "\u58F0\u97F3:\u9759\u97F3" : "\u58F0\u97F3:\u5F00";
  }
  function showOffline(desc) {
    const box = $("stage-offline");
    if (!box) return;
    if (desc && $("stage-offline-desc")) $("stage-offline-desc").textContent = desc;
    box.hidden = false;
    $("stage")?.classList.add("is-offline");
  }
  function hideOffline() {
    const box = $("stage-offline");
    if (box) box.hidden = true;
    $("stage")?.classList.remove("is-offline");
  }
  function closeDrawers() {
    document.querySelectorAll(".drawer.is-open").forEach((d) => d.classList.remove("is-open"));
    const app = $("app");
    if (app) app.classList.remove("drawer-open", "panel-wide");
    document.querySelectorAll("[data-drawer]").forEach((btn) => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-expanded", "false");
    });
  }
  async function toggleFullscreen() {
    const root = $("mirror-layout");
    if (!root) return;
    if (!document.fullscreenElement) {
      closeDrawers();
      await root.requestFullscreen?.();
      root.classList.add("is-fullscreen");
      setFsButtonLabel(true);
      if ($("fs-float")) $("fs-float").hidden = false;
    } else {
      await document.exitFullscreen?.();
      root.classList.remove("is-fullscreen");
      setFsButtonLabel(false);
      if ($("fs-float")) $("fs-float").hidden = true;
    }
    fitCanvas();
  }
  function setFsButtonLabel(onFs) {
    const label = onFs ? "\u9000\u51FA\u5168\u5C4F" : "\u5168\u5C4F";
    const span = $("btn-fullscreen")?.querySelector("span");
    if (span) span.textContent = label;
    const fsLbl = $("btn-fs-fullscreen")?.querySelector(".lbl3");
    if (fsLbl) fsLbl.textContent = label;
  }
  function releaseCanvasInputs() {
    _canvasAbort?.abort();
    _canvasAbort = null;
    _keyboardAbort?.abort();
    _keyboardAbort = null;
    if (_globalRelease) {
      window.removeEventListener("blur", _globalRelease);
      document.removeEventListener("pointercancel", _globalRelease);
      _globalRelease = null;
    }
    if (_globalVis) {
      document.removeEventListener("visibilitychange", _globalVis);
      _globalVis = null;
    }
  }
  function fitCanvas() {
    const canvas = document.querySelector("#stage canvas");
    const stage = $("stage");
    if (!canvas || !stage) return;
    const fs = !!document.fullscreenElement || !!$("mirror-layout")?.classList.contains("is-fullscreen");
    let liveSize = null;
    try {
      liveSize = mirror._size;
    } catch {
      liveSize = null;
    }
    let nw = Number(canvas.width) || Number(canvas.videoWidth) || Number(liveSize?.width) || 0;
    let nh = Number(canvas.height) || Number(canvas.videoHeight) || Number(liveSize?.height) || 0;
    if (!nw || !nh) {
      const res = ($("stat-res")?.textContent || "").match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (res) {
        nw = Number(res[1]);
        nh = Number(res[2]);
      }
    }
    if (!nw || !nh) {
      nw = 16;
      nh = 9;
    }
    const ratio = nw / nh;
    const cs = getComputedStyle(stage);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const GAP = 4;
    let maxW, maxH;
    if (fs) {
      maxW = window.innerWidth - GAP * 2;
      maxH = window.innerHeight - padY;
    } else {
      const rect = stage.getBoundingClientRect();
      maxW = Math.max(120, rect.width - padX - GAP * 2);
      maxH = Math.max(120, rect.height - padY - GAP * 2);
    }
    let dw = maxW;
    let dh = dw / ratio;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * ratio;
    }
    const rot = Number(canvas.dataset.rotate || 0);
    canvas.style.width = Math.round(dw) + "px";
    canvas.style.height = Math.round(dh) + "px";
    canvas.style.objectFit = "fill";
    canvas.style.transformOrigin = "center center";
    canvas.style.transform = rot ? "rotate(" + rot + "deg)" : "none";
    positionHud(canvas);
  }
  function positionHud() {
    return;
  }
  function setViewRotate(deg) {
    const canvas = document.querySelector("#stage canvas");
    if (!canvas) return;
    canvas.dataset.rotate = String(deg || 0);
    fitCanvas();
    toast(deg ? "\u753B\u9762\u65CB\u8F6C " + deg + "\xB0" : "\u753B\u9762\u5DF2\u56DE\u6B63");
  }
  async function pcShot() {
    const blob = await mirror.snapshot();
    if (!blob) {
      toast("\u6682\u65E0\u753B\u9762");
      return;
    }
    const dataUrl = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    });
    const b64 = (dataUrl.split(",")[1] || "").trim();
    if (!b64) throw new Error("\u622A\u56FE\u7F16\u7801\u5931\u8D25");
    const resp = await fetch("/api/save-shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "pc-shot-" + Date.now() + ".png", data: b64 })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || "\u4FDD\u5B58\u5230\u7535\u8111\u5931\u8D25");
    try {
      await fetch("/api/open-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: data.path })
      });
    } catch {
    }
    toast("\u7535\u8111\u622A\u5C4F\u5DF2\u4FDD\u5B58\u5E76\u6253\u5F00", data.name || data.path);
    logLine("ok", "pc-shot " + data.path);
  }
  function runAct(act) {
    const map = {
      back: () => ctrl?.back(),
      home: () => ctrl?.home(),
      recents: () => ctrl?.recents(),
      power: () => ctrl?.power(),
      "vol-up": () => ctrl?.volumeUp(),
      "vol-down": () => ctrl?.volumeDown(),
      "screen-on": () => ctrl?.wakeUp ? ctrl.wakeUp() : ctrl?.screenOn(),
      "screen-off": () => ctrl?.screenOffKeepMirror ? ctrl.screenOffKeepMirror() : ctrl?.screenOff(),
      rotate: () => ctrl?.rotate(),
      menu: () => ctrl?.menu(),
      notify: () => ctrl?.expandNotifications(),
      "notify-collapse": () => ctrl?.collapseNotifications(),
      settings: () => ctrl?.expandSettings(),
      bs: () => ctrl?.backspace(),
      del: () => ctrl?.deleteKey(),
      "phone-shot": async () => {
        const result = await ctrl?.phoneScreenshot();
        shotToast(result);
      },
      "pc-shot": pcShot,
      "rot-l": () => setViewRotate(270),
      "rot-0": () => setViewRotate(0),
      "rot-r": () => setViewRotate(90),
      stop: () => $("btn-stop")?.click(),
      "fs-full": () => toggleFullscreen()
    };
    const fn = map[act];
    if (!fn) return;
    if (act !== "rot-l" && act !== "rot-0" && act !== "rot-r" && act !== "stop" && !ctrl) {
      toast("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
      return;
    }
    Promise.resolve(fn()).then(() => logLine("ok", "\u6307\u4EE4 " + act)).catch((e) => {
      logLine("error", act + " \u5931\u8D25 " + String(e?.message || e));
      toast("\u6307\u4EE4\u5931\u8D25", String(e?.message || e));
    });
  }
  var _globalRelease = null;
  var _globalVis = null;
  function bindKeyboardSink(controller, canvas) {
    const sink = $("key-sink");
    if (!sink) return;
    _keyboardAbort?.abort();
    _keyboardAbort = new AbortController();
    const signal = _keyboardAbort.signal;
    canvas.addEventListener(
      "pointerdown",
      () => {
        setTimeout(() => {
          try {
            sink.focus({ preventScroll: true });
          } catch {
          }
        }, 0);
      },
      { passive: true, signal }
    );
    let buf = "";
    let timer = null;
    let composing = false;
    let skipInput = "";
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      timer = null;
      buf = "";
      composing = false;
      skipInput = "";
    }, { once: true });
    const flush = () => {
      const text = buf;
      buf = "";
      if (text) sendTypedText(text).catch(() => {
      });
    };
    async function sendTypedText(text) {
      if (!text) return;
      if (hasNonAscii(text)) {
        await sendTextSmart(text, { interactive: false });
        return;
      }
      try {
        await controller.injectText(text);
      } catch {
        if (textInput?.active) await textInput.send(text);
        else throw new Error("\u6587\u672C\u6CE8\u5165\u5931\u8D25");
      }
    }
    sink.addEventListener("compositionstart", () => {
      composing = true;
      clearTimeout(timer);
    }, { signal });
    sink.addEventListener("compositionend", (e) => {
      composing = false;
      const text = e.data || "";
      sink.value = "";
      if (text) {
        skipInput = text;
        sendTypedText(text).catch((err) => logLine("error", "IME \u4E0A\u5C4F\u5931\u8D25 " + String(err?.message || err)));
      }
    }, { signal });
    sink.addEventListener("input", (e) => {
      if (composing || e.isComposing) return;
      const text = sink.value || "";
      sink.value = "";
      if (!text) return;
      if (skipInput && text === skipInput) {
        skipInput = "";
        return;
      }
      sendTypedText(text).catch((err) => logLine("error", "\u8F93\u5165\u5931\u8D25 " + String(err?.message || err)));
    }, { signal });
    sink.addEventListener("keydown", async (e) => {
      if (e.isComposing || composing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          if (text) await sendTextSmart(text, { interactive: false });
        } catch (err) {
          logLine("error", "\u7C98\u8D34\u5230\u624B\u673A\u5931\u8D25 " + String(err?.message || err));
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) {
        e.preventDefault();
        buf += e.key;
        clearTimeout(timer);
        timer = setTimeout(flush, 25);
        return;
      }
      const special = {
        Backspace: () => controller.backspace(),
        Delete: () => controller.deleteKey(),
        Enter: () => controller.enter(),
        Tab: () => controller.tab(),
        Escape: () => controller.escape(),
        ArrowUp: () => controller.tapKey(19),
        ArrowDown: () => controller.tapKey(20),
        ArrowLeft: () => controller.tapKey(21),
        ArrowRight: () => controller.tapKey(22),
        Home: () => controller.tapKey(122),
        End: () => controller.tapKey(123),
        PageUp: () => controller.pageUp(),
        PageDown: () => controller.pageDown()
      };
      const fn = special[e.key];
      if (!fn) return;
      e.preventDefault();
      clearTimeout(timer);
      flush();
      try {
        await fn();
      } catch (err) {
        logLine("error", "\u6309\u952E\u5931\u8D25 " + e.key + " " + String(err?.message || err));
      }
    }, { signal });
  }
  function bindControl(controller, canvas) {
    ctrl = controller;
    if (!canvas) return;
    releaseCanvasInputs();
    _canvasAbort = new AbortController();
    const signal = _canvasAbort.signal;
    controller.releaseAllPointers().catch(() => {
    });
    const pos = (e) => controller.toDevice(e.clientX, e.clientY, canvas);
    const safe = (fn) => (e) => {
      Promise.resolve(fn(e)).catch((err) => {
        logLine("error", "\u89E6\u63A7\u4E8B\u4EF6\u5931\u8D25 " + String(err?.message || err));
      });
    };
    canvas.addEventListener("pointerdown", safe(async (e) => {
      e.preventDefault();
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {
      }
      const { x, y } = pos(e);
      await controller.pointerDown(e.pointerId, x, y);
    }), { signal });
    canvas.addEventListener("pointermove", safe(async (e) => {
      if (!controller.active.has(e.pointerId)) return;
      e.preventDefault();
      const { x, y } = pos(e);
      await controller.pointerMove(e.pointerId, x, y);
    }), { signal });
    const up = safe((e) => controller.pointerUp(e.pointerId));
    canvas.addEventListener("pointerup", up, { signal });
    canvas.addEventListener("pointercancel", safe((e) => controller.pointerCancel(e.pointerId)), { signal });
    canvas.addEventListener("lostpointercapture", up, { signal });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
    canvas.addEventListener(
      "wheel",
      safe(async (e) => {
        e.preventDefault();
        const { x, y } = pos(e);
        await controller.scroll(
          x,
          y,
          Math.max(-1, Math.min(1, -e.deltaX / 320)),
          Math.max(-1, Math.min(1, -e.deltaY / 320))
        );
      }),
      { passive: false, signal }
    );
    if (_globalRelease) {
      window.removeEventListener("blur", _globalRelease);
      document.removeEventListener("pointercancel", _globalRelease);
    }
    if (_globalVis) document.removeEventListener("visibilitychange", _globalVis);
    _globalRelease = () => controller.releaseAllPointers().catch(() => {
    });
    _globalVis = () => {
      if (document.hidden) _globalRelease();
    };
    window.addEventListener("blur", _globalRelease);
    document.addEventListener("pointercancel", _globalRelease);
    document.addEventListener("visibilitychange", _globalVis);
    bindKeyboardSink(controller, canvas);
    fitCanvas();
  }
  var devicePanels = null;
  var textInput = null;
  var mirror = new AdbMirror({
    stage: $("stage"),
    status: $("status"),
    onStatus(text) {
      const pill = $("status");
      if (pill) {
        pill.textContent = text;
        const down = text === "\u5DF2\u65AD\u5F00" || text === "\u6295\u5C4F\u5DF2\u7ED3\u675F" || text.indexOf("\u94FE\u8DEF\u5DF2\u65AD\u5F00") >= 0;
        pill.classList.toggle("offline", down || text === "\u672A\u8FDE\u63A5");
        pill.classList.toggle("dropped", down);
      }
      const mirroring = text === "\u6295\u5C4F\u4E2D";
      document.body.classList.toggle("mirroring", mirroring);
      if (mirroring) {
        usbStarting = false;
        if (mode === "usb") {
          usbConnectedAt = Date.now();
          if (!usbGuardWorker && !usbGuardFallback) startUsbGuard();
          clearTimeout(usbStableTimer);
          usbStableTimer = setTimeout(() => {
            usbAutoRetries = 0;
            logLine("ok", "USB \u5DF2\u8FDE\u7EED\u7A33\u5B9A 60 \u79D2\uFF0C\u81EA\u52A8\u91CD\u8FDE\u8BA1\u6570\u5DF2\u91CD\u7F6E");
          }, 6e4);
        }
        setStepsDone(3);
        hideOffline();
        if ($("placeholder")) $("placeholder").style.display = "none";
        devicePanels?.notifyConnected();
        if (mirror.adb) {
          textInput = new DeviceTextInput(mirror.adb, mirror.serialKey);
          refreshImeStatus();
          setTimeout(refreshImeStatus, 900);
          setTimeout(autoProvisionIme, 1200);
        }
      }
      if (text === "\u5DF2\u65AD\u5F00" || text === "\u6295\u5C4F\u5DF2\u7ED3\u675F") {
        stopUsbGuard();
        clearTimeout(usbStableTimer);
        document.body.classList.remove("mirroring");
        ctrl = null;
        releaseCanvasInputs();
        if (textInput) {
          textInput.restore().catch(() => {
          });
          textInput = null;
          refreshImeStatus();
        }
        devicePanels?.markDisconnected();
        setStepsDone(0);
        if ($("placeholder")) {
          $("placeholder").style.display = "flex";
          if ($("placeholder-text")) {
            $("placeholder-text").textContent = text === "\u6295\u5C4F\u5DF2\u7ED3\u675F" ? "\u8FDE\u63A5\u5DF2\u7ED3\u675F\uFF0C\u53EF\u91CD\u65B0\u8FDE\u63A5" : "\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u53EF\u91CD\u65B0\u8FDE\u63A5";
          }
        }
        showOffline(
          text === "\u6295\u5C4F\u5DF2\u7ED3\u675F" ? "\u8FDE\u63A5\u5DF2\u7ED3\u675F\uFF0C\u53EF\u91CD\u65B0\u8FDE\u63A5" : mode === "wifi" ? "\u65E0\u7EBF\u5DF2\u65AD\u5F00\uFF1A\u624B\u673A\u7AEF\u770B\u95E8\u72D7\u4F1A\u81EA\u52A8\u7ED3\u675F scrcpy\uFF0C\u7EA6 10 \u79D2\u5185\u6062\u590D\u624B\u673A\u5916\u653E" : "\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u53EF\u91CD\u65B0\u8FDE\u63A5"
        );
        if ((text === "\u5DF2\u65AD\u5F00" || text === "\u6295\u5C4F\u5DF2\u7ED3\u675F") && mode === "usb") {
          scheduleUsbReconnect(text);
        }
      } else if (text.indexOf("\u94FE\u8DEF\u5DF2\u65AD\u5F00") >= 0) {
        showOffline("\u65E0\u7EBF\u94FE\u8DEF\u5DF2\u65AD\u5F00\uFF0C\u6B63\u5728\u5C1D\u8BD5\u6062\u590D\u624B\u673A\u58F0\u97F3\u2026");
      }
      logLine("info", text);
      if (text === "\u6295\u5C4F\u5DF2\u7ED3\u675F" || text === "\u5DF2\u65AD\u5F00") {
        logLine("error", "\u6295\u5C4F\u8FDE\u63A5\u5DF2\u65AD\u5F00 / \u5DF2\u7ED3\u675F");
      }
    },
    onError(err) {
      logLine("error", "\u6D41\u9519\u8BEF " + String(err?.message || err));
      toast("\u9519\u8BEF", String(err?.message || err));
    },
    onStats(s) {
      const liveCanvas = document.querySelector("#stage canvas");
      if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0 && (s.frames ?? 0) > 0) {
        const cw = Number(liveCanvas.width);
        const ch = Number(liveCanvas.height);
        if (cw !== s.width || ch !== s.height) {
          s = { ...s, width: cw, height: ch };
          try {
            mirror._size = { width: cw, height: ch };
          } catch {
          }
        }
      }
      if ($("stat-res")) {
        const sizeTxt = s.width && s.height ? s.width + "\xD7" + s.height : "\u2014";
        const o = collectOptions();
        $("stat-res").textContent = o.maxSize > 0 ? sizeTxt + " (\u9650\u5236" + o.maxSize + ")" : sizeTxt + " (\u539F\u59CB)";
      }
      if ($("stat-frames")) $("stat-frames").textContent = String(s.frames ?? 0);
      if ($("stat-fps")) $("stat-fps").textContent = s.fps != null ? String(s.fps) : "\u2014";
      if ($("m-fps")) $("m-fps").textContent = s.fps != null && s.fps !== "0" ? s.fps + " fps" : "\u2014";
      if ($("m-res")) $("m-res").textContent = s.width && s.height ? s.width + "\xD7" + s.height : "\u2014";
      if ($("m-vlat")) {
        $("m-vlat").textContent = s.latencyMs != null ? s.latencyMs + " ms" : "\u2014";
        $("m-vlat").title = "\u4ECE\u89C6\u9891\u5305\u5230\u8FBE\u7535\u8111\u5230\u753B\u5230\u5C4F\u5E55\u7684\u7AEF\u5230\u7AEF\u5EF6\u8FDF\uFF08\u542B\u89E3\u7801+\u6E32\u67D3\u8282\u594F\u63A7\u5236\uFF09";
      }
      if ($("m-alat")) {
        $("m-alat").textContent = s.audioLatency != null ? s.audioLatency + " ms" : "\u2014";
        $("m-alat").title = "\u5DF2\u6392\u7A0B\u97F3\u9891\u7F13\u51B2 + \u58F0\u5361\u8F93\u51FA\u5EF6\u8FDF\uFF1B\u8D8A\u5C0F\u8D8A\u5B9E\u65F6\uFF0C\u8FC7\u5C0F\u4F1A\u65AD\u7EED";
      }
      if ($("stat-vdrop")) $("stat-vdrop").textContent = String(s.vdrop ?? 0);
      if ($("stat-codec") && s.renderer) {
        const rendererZh = { webgl: "WebGL", bitmap: "\u4F4D\u56FE" }[String(s.renderer)] || s.renderer;
        $("stat-codec").textContent = "H.264 \xB7 " + rendererZh;
      }
      if ($("stat-audio") && s.audio) {
        const short = String(s.audio).split(" \xB7 ")[0];
        $("stat-audio").textContent = short;
        $("stat-audio").title = String(s.audio);
      }
      if ($("audio-hint") && s.audio) $("audio-hint").textContent = "\u58F0\u97F3:" + s.audio;
      fitCanvas();
    },
    onFirstFrame() {
      if ($("placeholder")) $("placeholder").style.display = "none";
      fitCanvas();
      toast("\u5DF2\u51FA\u753B\u9762");
      logLine("ok", "\u9996\u5E27\u5DF2\u6E32\u67D3");
    },
    onController(controller, canvas) {
      controller.onError = (err, where) => {
        logLine("error", "\u63A7\u5236\u6307\u4EE4 " + where + " \u5931\u8D25: " + String(err?.message || err));
      };
      bindControl(controller, canvas);
    },
    onLog: (msg) => logLine("log", String(msg)),
    // 关闭 ADB 通道前恢复手机原输入法（此时通道仍可用）；断开回调里的 restore 仅作二次兜底
    onBeforeTeardown: async () => {
      if (textInput) {
        try {
          await textInput.restore();
        } catch (e) {
          logLine("error", "\u65AD\u5F00\u524D\u6062\u590D\u8F93\u5165\u6CD5\u5931\u8D25 " + String(e?.message || e));
        }
      }
    }
  });
  devicePanels = bindDevicePanels({
    getMirror: () => mirror,
    toast,
    log: logLine
  });
  function showFail(err) {
    console.error(err);
    const baseMsg = err instanceof MirrorError || err instanceof WirelessError ? err.message : String(err?.message || err);
    const serverOutput = Array.isArray(err?.output) ? err.output.map((line) => String(line).trim()).filter(Boolean).join("\n") : "";
    const msg = baseMsg + (serverOutput ? "\n\u8BBE\u5907\u7AEF\u8F93\u51FA\uFF1A\n" + serverOutput : "");
    const guide = err instanceof MirrorError ? err.guide : err instanceof WirelessError ? wirelessHelp() : "";
    const isBusy = err instanceof MirrorError && err.code === "DEVICE_BUSY";
    toast("\u5931\u8D25", guide ? msg + "\n" + guide : msg, {
      duration: isBusy ? 15e3 : 8e3,
      html: isBusy ? '<div class="shot-actions"><button type="button" class="btn primary xs-btn" data-kill-adb="1">\u6E05\u7406\u5360\u7528\u8FDB\u7A0B (adb)</button></div>' : ""
    });
    if (isBusy) bindKillAdbButtons();
    logLine("error", msg);
    if ($("placeholder")) {
      $("placeholder").style.display = "flex";
      if ($("placeholder-text")) $("placeholder-text").textContent = msg;
    }
  }
  window.addEventListener("unhandledrejection", (event) => {
    const reason = String(event.reason?.message || event.reason || "");
    if (!/transferIn|transferOut|transfer was cancelled|device must be opened first/i.test(reason)) return;
    if (!mirror._stopRequested && !mirror._dropHandled) return;
    event.preventDefault();
    logLine("info", "USB \u6536\u5C3E\u4F20\u8F93\u5DF2\u53D6\u6D88\uFF08\u6B63\u5E38\u5173\u95ED\uFF09");
  });
  var hbWorker = null;
  var hbFallback = null;
  function startHeartbeatWorker() {
    stopHeartbeatWorker();
    try {
      const code = "let t=null;onmessage=function(e){if(e.data==='start'){if(t)clearInterval(t);t=setInterval(function(){postMessage(1)},5000)}else if(e.data==='stop'){if(t)clearInterval(t);t=null}};";
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      hbWorker = new Worker(url);
      hbWorker.onmessage = () => {
        if (mirror.running) mirror.heartbeat();
      };
      hbWorker.postMessage("start");
    } catch (e) {
      logLine("log", "\u5FC3\u8DF3 Worker \u4E0D\u53EF\u7528\uFF0C\u6539\u7528\u9875\u9762\u5B9A\u65F6\u5668\uFF1A" + String(e?.message || e));
      hbFallback = setInterval(() => {
        if (mirror.running) mirror.heartbeat();
      }, 6e3);
    }
  }
  function stopHeartbeatWorker() {
    if (hbFallback) {
      clearInterval(hbFallback);
      hbFallback = null;
    }
    if (!hbWorker) return;
    try {
      hbWorker.postMessage("stop");
      hbWorker.terminate();
    } catch {
    }
    hbWorker = null;
  }
  function startWifiKeepAlive(target) {
    stopWifiKeepAlive();
    startHeartbeatWorker();
    let fails = 0;
    let inFlight = false;
    wifiKeepAlive = setInterval(async () => {
      if (!mirror.running || inFlight) return;
      inFlight = true;
      try {
        const ok = await mirror.ping(1200);
        if (ok) {
          fails = 0;
          return;
        }
        const lastRecv = mirror.linkLastRecv();
        if (lastRecv && Date.now() - lastRecv < 2500) {
          fails = 0;
          return;
        }
        fails += 1;
        logLine("log", "\u65E0\u7EBF\u5FC3\u8DF3\u5931\u8D25 " + fails + "/2 \xB7 " + target);
        if (fails >= 2) {
          stopWifiKeepAlive();
          logLine("error", "\u65E0\u7EBF\u94FE\u8DEF\u5DF2\u65AD\u5F00\uFF0C\u6B63\u5728\u91CA\u653E\u624B\u673A\u7AEF\u97F3\u9891");
          toast("\u65E0\u7EBF\u5DF2\u65AD\u5F00", "\u6B63\u5728\u5C1D\u8BD5\u6062\u590D\u624B\u673A\u58F0\u97F3\u2026");
          await mirror.handleLinkLost();
        }
      } finally {
        inFlight = false;
      }
    }, 1200);
    logLine("info", "\u65E0\u7EBF\u4FDD\u6D3B\u5DF2\u542F\u52A8(1.2s \u63A2\u6D4B\uFF0C\u7EA6 3~5 \u79D2\u5185\u611F\u77E5\u65AD\u7EBF)");
  }
  function stopWifiKeepAlive() {
    stopHeartbeatWorker();
    if (wifiKeepAlive) {
      clearInterval(wifiKeepAlive);
      wifiKeepAlive = null;
      logLine("info", "\u65E0\u7EBF\u4FDD\u6D3B\u5DF2\u505C\u6B62");
    }
  }
  async function fixPhoneAudio() {
    logLine("info", "\u5F3A\u529B\u6062\u590D\u624B\u673A\u58F0\u97F3\uFF1A\u7ED3\u675F scrcpy \u2192 \u5173\u9759\u97F3/\u52FF\u6270 \u2192 \u91CD\u8BBE\u97F3\u91CF \u2192 \u91CD\u7B97\u97F3\u9891\u8DEF\u7531\u2026");
    try {
      if (!mirror.adb) {
        if (!mirror._wirelessTarget) {
          logLine("error", "\u5F53\u524D\u672A\u8FDE\u63A5\u624B\u673A\uFF0C\u8BF7\u5148\u8FDE\u63A5\u540E\u518D\u8BD5");
          toast("\u65E0\u6CD5\u6062\u590D", "\u8BF7\u5148\u8FDE\u63A5\u624B\u673A");
          return;
        }
        logLine("info", "\u672A\u8FDE\u63A5\uFF0C\u5148\u91CD\u8FDE\u624B\u673A\u2026");
        const ok = await mirror.ensureAdbForRepair();
        if (!ok) {
          logLine("error", "\u91CD\u8FDE\u5931\u8D25\uFF1A\u8BF7\u786E\u8BA4\u624B\u673A\u4E0E\u7535\u8111\u5728\u540C\u4E00 Wi-Fi\uFF08\u65E0\u7EBF\u8C03\u8BD5\u5DF2\u5F00\u542F\uFF09");
          toast("\u91CD\u8FDE\u5931\u8D25", "\u8BF7\u68C0\u67E5\u624B\u673A\u7F51\u7EDC\u540E\u91CD\u8BD5");
          return;
        }
        logLine("log", "\u5DF2\u91CD\u8FDE\u624B\u673A\uFF0C\u5F00\u59CB\u6062\u590D\u2026");
      }
      const sdk = await mirror.getAndroidSdk();
      if (sdk) logLine("log", "\u624B\u673A Android SDK=" + sdk);
      await mirror.forceAudioRestore();
      const report = await mirror.diagnoseAudio();
      if (report) {
        const remain = /\[scrcpy 进程\]\s*\n?\s*([^\n]*)/.exec(report);
        const vol = report.split("[\u5A92\u4F53\u97F3\u91CF/\u9759\u97F3/\u8DEF\u7531]")[1] || "";
        const volLine = vol.split("\n").filter((l) => /STREAM_MUSIC|streamVolume|muted/i.test(l)).slice(0, 3);
        logLine("log", "\u6062\u590D\u540E\u8BCA\u65AD \xB7 scrcpy \u8FDB\u7A0B: " + (remain ? remain[1].trim() : "\u672A\u77E5"));
        if (volLine.length) logLine("log", "\u97F3\u91CF\u72B6\u6001: " + volLine.join(" | ").trim());
        const zen = report.split("[\u52FF\u6270 zen_mode]")[1];
        if (zen && /\n\s*[1-9]/.test(zen)) logLine("warn", "\u624B\u673A\u4ECD\u5904\u4E8E\u52FF\u6270/\u9759\u97F3\u6A21\u5F0F\uFF0C\u8BF7\u624B\u52A8\u5173\u95ED");
        report.split("\n").filter((l) => l.trim()).slice(0, 30).forEach((l) => logLine("log", "\xB7 " + l.trim()));
      }
      logLine("info", "\u6062\u590D\u547D\u4EE4\u5DF2\u5168\u90E8\u4E0B\u53D1\u3002\u82E5\u624B\u673A\u4ECD\u65E0\u58F0\uFF0C\u8BF7\uFF1A\u63D2\u62D4\u4E00\u6B21\u624B\u673A / \u64AD\u653E\u4EFB\u610F\u89C6\u9891\u6D4B\u8BD5 / \u6216\u91CD\u542F\u624B\u673A");
      toast("\u5DF2\u6267\u884C\u5F3A\u529B\u6062\u590D", "\u4ECD\u65E0\u58F0\u8BF7\u67E5\u770B\u65E5\u5FD7\u5E76\u53CD\u9988");
    } catch (e) {
      logLine("error", "\u6062\u590D\u5931\u8D25 " + String(e?.message || e));
      toast("\u6062\u590D\u5931\u8D25", String(e?.message || e));
    }
  }
  async function refreshUsbDevices(silent) {
    const sel = $("usb-device-select");
    if (!sel) return;
    const devices = await mirror.listUsbDevices();
    const current = sel.value || savedDeviceSerial;
    sel.innerHTML = '<option value="">\u81EA\u52A8\u9009\u62E9\u8BBE\u5907</option>' + devices.map(
      (d) => '<option value="' + String(d.serial).replace(/"/g, "") + '">' + d.name + " (" + d.serial + ")</option>"
    ).join("");
    if (current && devices.some((d) => d.serial === current)) {
      sel.value = current;
    }
    if (!silent) {
      logLine("info", "USB \u8BBE\u5907\u5217\u8868:" + (devices.length ? devices.length + " \u53F0" : "\u65E0\u5DF2\u6388\u6743\u8BBE\u5907"));
      if (!devices.length) toast("\u6CA1\u6709\u5DF2\u6388\u6743\u8BBE\u5907", "\u70B9\u300C\u6DFB\u52A0\u300D\u5728\u7CFB\u7EDF\u5F39\u7A97\u4E2D\u9009\u62E9\u624B\u673A");
    }
  }
  function bindKillAdbButtons() {
    document.querySelectorAll("[data-kill-adb]").forEach((b) => {
      if (b.dataset.bound === "1") return;
      b.dataset.bound = "1";
      b.addEventListener("click", async () => {
        b.disabled = true;
        b.textContent = "\u6E05\u7406\u4E2D\u2026";
        try {
          const resp = await fetch("/api/kill-adb", { method: "POST" });
          const data = await resp.json().catch(() => ({}));
          logLine("ok", "\u6E05\u7406\u5360\u7528 " + JSON.stringify(data.detail || []));
          toast("\u5DF2\u6E05\u7406 adb \u5360\u7528", "\u8BF7\u91CD\u65B0\u70B9\u300C\u5F00\u59CB USB \u6295\u5C4F\u300D");
        } catch (e) {
          toast("\u6E05\u7406\u5931\u8D25", String(e?.message || e));
          logLine("error", "kill-adb " + String(e?.message || e));
        }
      });
    });
  }
  async function startUsb(allowAnyMode = false, autoRetry = false) {
    if (!allowAnyMode && mode !== "usb") {
      toast("\u8BF7\u5148\u9009\u62E9 USB \u6A21\u5F0F", "USB \u4E0E\u65E0\u7EBF\u53EA\u80FD\u4E8C\u9009\u4E00");
      return;
    }
    if (usbStarting) return;
    if (!autoRetry) {
      usbManualStop = false;
      usbAutoRetries = 0;
      clearTimeout(usbRetryTimer);
    }
    stopUsbGuard();
    clearTimeout(usbStableTimer);
    usbStarting = true;
    usbConnectedAt = 0;
    hideOffline();
    const opts = collectOptions();
    const preferSerial = $("usb-device-select")?.value || null;
    saveSettings();
    logLine("info", "USB \u76F4\u8FDE " + (preferSerial || "auto") + " " + JSON.stringify(opts));
    if ($("btn-start")) $("btn-start").disabled = true;
    if ($("placeholder-text")) $("placeholder-text").textContent = "USB \u76F4\u8FDE\u4E2D\u2026";
    setStepsDone(1);
    let adbReleased = false;
    try {
      stopWifiKeepAlive();
      try {
        const resp = await fetch("/api/kill-adb", { method: "POST" });
        const info = await resp.json().catch(() => ({}));
        adbReleased = info.changed === true;
        logLine("info", "\u91CA\u653E\u672C\u673A adb \u5360\u7528 " + JSON.stringify(info.detail || []));
      } catch {
      }
      await new Promise((resolve) => setTimeout(resolve, adbReleased ? 3e3 : 1500));
      startUsbGuard();
      logLine("info", "\u68C0\u67E5\u5DF2\u6388\u6743 USB \u8BBE\u5907\u2026");
      try {
        await mirror.start(preferSerial, opts, !autoRetry);
      } catch (err) {
        if (err?.code === "DEVICE_BUSY" && !adbReleased) {
          logLine("info", "\u68C0\u6D4B\u5230 adb \u5728\u540E\u53F0\u62A2\u5360\u4E86\u63A5\u53E3\uFF0C\u91CA\u653E\u540E\u91CD\u8BD5");
          try {
            const resp = await fetch("/api/kill-adb", { method: "POST" });
            const info = await resp.json().catch(() => ({}));
            adbReleased = info.changed === true;
          } catch {
          }
          await new Promise((resolve) => setTimeout(resolve, 3e3));
          await mirror.start(preferSerial, opts, !autoRetry);
        } else {
          throw err;
        }
      }
      if (mirror.device?.serial && $("stat-serial")) {
        $("stat-serial").textContent = String(mirror.device.serial);
      }
      refreshDeviceBanner();
      toast("USB \u8FDE\u63A5\u6210\u529F");
      logLine("ok", "USB \u8FDE\u63A5\u6210\u529F");
    } catch (err) {
      stopUsbGuard();
      clearTimeout(usbStableTimer);
      showFail(err);
      usbStarting = false;
      if (autoRetry && !usbManualStop) {
        if (err?.code === "NO_SERVER" && !mirror.hasServerJarCache()) {
          logLine("error", "\u672C\u5730\u670D\u52A1\u4E0D\u53EF\u7528\u4E14\u6CA1\u6709 scrcpy-server.jar \u7F13\u5B58\uFF0C\u5DF2\u6682\u505C\u81EA\u52A8\u91CD\u8FDE\uFF1B\u542F\u52A8\u672C\u5730\u670D\u52A1\u540E\u8BF7\u70B9\u300C\u91CD\u65B0\u8FDE\u63A5\u300D");
          toast("\u672C\u5730\u670D\u52A1\u5DF2\u505C\u6B62", "\u542F\u52A8 scrcpy \u4FBF\u6377\u7F51\u9875\u7248\u540E\u5237\u65B0\u9875\u9762\u518D\u8FDE\u63A5");
        } else {
          scheduleUsbReconnect("\u91CD\u8FDE\u5931\u8D25\uFF1A" + String(err?.message || err));
        }
      }
    } finally {
      usbStarting = false;
      if ($("btn-start")) $("btn-start").disabled = false;
    }
  }
  function renderScanList(devices) {
    const list = $("scan-list");
    if (!list) return;
    if (!devices.length) {
      list.innerHTML = '<div class="scan-empty">\u672A\u53D1\u73B0\u8BBE\u5907</div>';
      return;
    }
    list.innerHTML = devices.map(
      (d, i) => '<label class="scan-item' + (i === 0 ? " selected" : "") + '"><input type="radio" name="wifi-dev" value="' + d.target + '"' + (i === 0 ? " checked" : "") + " /><span>" + d.target + "</span></label>"
    ).join("");
    list.querySelectorAll("input[name=wifi-dev]").forEach((r) => {
      r.addEventListener("change", () => {
        if ($("wireless-host")) $("wireless-host").value = r.value;
        saveSettings();
        list.querySelectorAll(".scan-item").forEach((x) => x.classList.remove("selected"));
        r.closest(".scan-item")?.classList.add("selected");
      });
    });
    if (devices[0] && $("wireless-host")) {
      $("wireless-host").value = devices[0].target;
      saveSettings();
    }
  }
  async function scanWifi(auto) {
    if ($("btn-scan")) $("btn-scan").disabled = true;
    if ($("scan-status")) $("scan-status").textContent = "\u6B63\u5728\u641C\u7D22\u672C\u5730\u65E0\u7EBF\u8BBE\u5907\u2026";
    if (!auto) toast("\u6B63\u5728\u641C\u7D22\u672C\u5730\u8BBE\u5907 IP\u2026");
    try {
      const devices = await scanWireless(2500);
      logLine("info", "\u641C\u7D22\u5B8C\u6210,\u53D1\u73B0 " + devices.length + " \u53F0 " + JSON.stringify(devices));
      renderScanList(devices);
      if ($("scan-status")) {
        $("scan-status").textContent = devices.length ? "\u53D1\u73B0 " + devices.length + " \u53F0,\u8BF7\u9009\u4E2D\u540E\u70B9\u300C\u8FDE\u63A5\u300D" : "\u672A\u53D1\u73B0\u8BBE\u5907\u3002\u8BF7\u624B\u673A\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5,\u4E14\u4E0E\u7535\u8111\u540C\u4E00 Wi-Fi\u3002";
      }
    } catch (err) {
      logLine("error", "\u641C\u7D22\u5931\u8D25 " + String(err?.message || err));
      if ($("scan-status")) $("scan-status").textContent = "\u641C\u7D22\u5931\u8D25:" + (err?.message || err);
      if (!auto) showFail(err);
    } finally {
      if ($("btn-scan")) $("btn-scan").disabled = false;
    }
  }
  async function connectWifi() {
    if (mode !== "wifi") {
      toast("\u8BF7\u5148\u9009\u62E9\u65E0\u7EBF\u6A21\u5F0F", "USB \u4E0E\u65E0\u7EBF\u53EA\u80FD\u4E8C\u9009\u4E00");
      return;
    }
    const target = ($("wireless-host")?.value || "").trim();
    if (!target) {
      toast("\u8BF7\u9009\u62E9\u6216\u586B\u5199 IP:\u7AEF\u53E3");
      return;
    }
    const opts = collectOptions();
    saveSettings();
    hideOffline();
    logLine("info", "\u65E0\u7EBF\u8FDE\u63A5 " + target + " " + JSON.stringify(opts));
    if ($("btn-wireless")) $("btn-wireless").disabled = true;
    if ($("placeholder-text")) $("placeholder-text").textContent = "\u65E0\u7EBF\u8FDE\u63A5\u4E2D\u2026";
    setStepsDone(1);
    try {
      stopWifiKeepAlive();
      if (mirror.running || mirror.adb) {
        try {
          await mirror.stop();
          hideOffline();
        } catch (e) {
          logLine("error", "\u6E05\u7406\u65E7\u8FDE\u63A5 " + String(e?.message || e));
        }
      }
      await mirror.startWireless(target, opts);
      if ($("stat-serial")) $("stat-serial").textContent = String(target);
      refreshDeviceBanner();
      toast("\u65E0\u7EBF\u8FDE\u63A5\u6210\u529F", target);
      logLine("ok", "\u65E0\u7EBF\u8FDE\u63A5\u6210\u529F " + target);
      startWifiKeepAlive(target);
    } catch (err) {
      logLine("error", "\u65E0\u7EBF\u8FDE\u63A5\u5931\u8D25 " + String(err?.message || err));
      try {
        mirror.status("\u8FDE\u63A5\u5931\u8D25");
      } catch {
      }
      showFail(err);
    } finally {
      if ($("btn-wireless")) $("btn-wireless").disabled = false;
    }
  }
  async function disconnectWifi() {
    try {
      stopWifiKeepAlive();
      await mirror.stop();
      hideOffline();
      if ($("placeholder")) $("placeholder").style.display = "flex";
      if ($("placeholder-text")) $("placeholder-text").textContent = "\u65E0\u7EBF\u5DF2\u65AD\u5F00";
      toast("\u5DF2\u65AD\u5F00\u65E0\u7EBF");
      logLine("info", "\u65E0\u7EBF\u5DF2\u624B\u52A8\u65AD\u5F00");
    } catch (err) {
      logLine("error", "\u65AD\u5F00\u5931\u8D25 " + String(err?.message || err));
      showFail(err);
    }
  }
  all(".mode-card").forEach((b) => {
    b.addEventListener("click", () => {
      setMode(b.getAttribute("data-mode"));
      if (mode === "wifi") setTimeout(() => scanWifi(true), 200);
    });
  });
  on("btn-usb-refresh", "click", () => refreshUsbDevices(false));
  on("btn-usb-add", "click", async () => {
    try {
      await mirror.pickUsbDevice();
      await refreshUsbDevices(true);
      const dev = mirror.device;
      if (dev?.serial && $("usb-device-select")) {
        $("usb-device-select").value = dev.serial;
        saveSettings();
      }
      toast("\u8BBE\u5907\u5DF2\u6388\u6743", dev?.serial || "");
      logLine("ok", "\u5DF2\u6388\u6743\u8BBE\u5907 " + (dev?.serial || "?"));
    } catch (err) {
      if (err?.code === "NO_DEVICE") {
        toast("\u5DF2\u53D6\u6D88\u9009\u62E9");
      } else {
        showFail(err);
      }
    }
  });
  on("usb-device-select", "change", saveSettings);
  on("btn-start", "click", () => startUsb());
  on("btn-start-2", "click", () => mode === "usb" ? startUsb() : connectWifi());
  on("btn-wifi-enable", "click", async () => {
    try {
      if (mirror.adb && mirror._wirelessTarget) {
        toast("\u5DF2\u7ECF\u662F\u65E0\u7EBF\u8FDE\u63A5", "\u65E0\u9700\u91CD\u590D\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5");
        return;
      }
      if (!mirror.adb) {
        toast("\u8BF7\u5148\u7528 USB \u8FDE\u63A5\u624B\u673A", "\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\u9700\u8981 USB \u901A\u9053");
        await startUsb(true);
        if (!mirror.adb) return;
      }
      toast("\u6B63\u5728\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5\u2026");
      const info = await enableWirelessViaUsb(mirror.adb, 5555);
      logLine("info", "tcpip 5555 => " + (info.target || info.message));
      if (info.target) {
        if ($("wireless-host")) $("wireless-host").value = info.target;
        saveSettings();
        setMode("wifi");
        toast("\u5DF2\u5F00\u542F\u65E0\u7EBF\u8C03\u8BD5", info.target + ",\u8BF7\u5728\u65E0\u7EBF\u6A21\u5F0F\u8FDE\u63A5");
      }
    } catch (err) {
      logLine("error", "\u5F00\u542F\u65E0\u7EBF\u5931\u8D25 " + String(err?.message || err));
      showFail(err);
    }
  });
  on("btn-scan", "click", () => scanWifi(false));
  on("btn-wireless", "click", connectWifi);
  on("btn-wifi-disconnect", "click", disconnectWifi);
  on("btn-stop", "click", async () => {
    usbManualStop = true;
    clearTimeout(usbRetryTimer);
    clearTimeout(usbStableTimer);
    stopUsbGuard();
    stopWifiKeepAlive();
    await mirror.stop();
    hideOffline();
    ctrl = null;
    document.body.classList.remove("mirroring");
    setStepsDone(0);
    if ($("placeholder")) $("placeholder").style.display = "flex";
    if ($("placeholder-text")) $("placeholder-text").textContent = "\u5DF2\u505C\u6B62\u6295\u5C4F";
    if ($("stat-fps")) $("stat-fps").textContent = "\u2014";
    if ($("fs-float")) $("fs-float").hidden = true;
    logLine("info", "\u5DF2\u505C\u6B62\u6295\u5C4F");
  });
  on("btn-stage-reconnect", "click", async () => {
    hideOffline();
    if (mode === "wifi") {
      const target = ($("wireless-host")?.value || "").trim();
      if (!target) {
        toast("\u8BF7\u5148\u586B\u5199\u624B\u673A IP:\u7AEF\u53E3", "\u6216\u7528\u300C\u81EA\u52A8\u641C\u7D22\u300D\u53D1\u73B0\u8BBE\u5907");
        setMode("wifi");
        return;
      }
      await connectWifi();
      return;
    }
    await startUsb();
  });
  on("btn-fullscreen", "click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const onFs = !!document.fullscreenElement;
    setFsButtonLabel(onFs);
    $("mirror-layout")?.classList.toggle("is-fullscreen", onFs);
    if ($("fs-float")) $("fs-float").hidden = !onFs;
    fitCanvas();
    requestAnimationFrame(fitCanvas);
    setTimeout(fitCanvas, 120);
  });
  on("btn-mute", "click", () => {
    mirror.toggleMute();
    setMuteUi(mirror.muted);
    toast(mirror.muted ? "\u5DF2\u9759\u97F3" : "\u5DF2\u5F00\u542F\u58F0\u97F3");
  });
  on("btn-fix-audio", "click", async () => {
    await fixPhoneAudio();
  });
  on("btn-screenshot", "click", async () => {
    try {
      await pcShot();
    } catch (e) {
      toast("\u622A\u5C4F\u5931\u8D25", String(e?.message || e));
      logLine("error", "pc-shot " + String(e?.message || e));
    }
  });
  async function shutdownServer() {
    try {
      await fetch("/api/shutdown", { method: "POST", cache: "no-store" });
    } catch {
    }
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) return true;
      } catch {
        return true;
      }
    }
    return false;
  }
  on("btn-stop-server", "click", async () => {
    if (!confirm("\u786E\u5B9A\u505C\u6B62\u672C\u5730\u670D\u52A1?\u5C06\u6E05\u7406\u8FDB\u7A0B\u5E76\u5173\u95ED\u672C\u7F51\u9875\u3002")) return;
    try {
      stopWifiKeepAlive();
      await Promise.race([
        mirror.stop().catch(() => {
        }),
        new Promise((r) => setTimeout(r, 3e3))
      ]);
      logLine("info", "\u6B63\u5728\u505C\u6B62\u672C\u5730\u670D\u52A1\u2026");
      let ok = await shutdownServer();
      if (!ok) {
        await new Promise((r) => setTimeout(r, 600));
        ok = await shutdownServer();
      }
      logLine(ok ? "info" : "error", ok ? "\u670D\u52A1\u5DF2\u505C\u6B62" : "\u670D\u52A1\u672A\u80FD\u505C\u6B62,\u8BF7\u8FD0\u884C stop.cmd");
      toast(ok ? "\u670D\u52A1\u5DF2\u505C\u6B62" : "\u670D\u52A1\u672A\u505C\u6B62", ok ? "\u6B63\u5728\u5173\u95ED\u9875\u9762\u2026" : "\u8BF7\u53CC\u51FB stop.cmd \u6E05\u7406");
      setTimeout(() => {
        try {
          window.close();
        } catch {
        }
        try {
          const msg = ok ? ["\u672C\u5730\u670D\u52A1\u5DF2\u505C\u6B62", "\u53EF\u5173\u95ED\u6B64\u6807\u7B7E\u9875,\u6216\u91CD\u65B0\u8FD0\u884C start.vbs"] : ["\u670D\u52A1\u672A\u80FD\u81EA\u52A8\u505C\u6B62", "\u8BF7\u8FD0\u884C\u76EE\u5F55\u4E0B\u7684 stop.cmd,\u6216\u4EFB\u52A1\u7BA1\u7406\u5668\u7ED3\u675F python.exe"];
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0e12;color:#e8ecf1;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px"><div><h2 style="margin:0 0 8px">' + msg[0] + '</h2><p style="color:#8b95a5">' + msg[1] + "</p></div></div>";
        } catch {
        }
      }, 300);
    } catch (err) {
      toast("\u505C\u6B62\u5931\u8D25", String(err?.message || err));
      logLine("error", "stop server " + String(err?.message || err));
    }
  });
  on("btn-show-guide", "click", () => {
    const p = $("guide-panel");
    if (p) {
      p.hidden = false;
      logLine("info", "\u6253\u5F00\u4F7F\u7528\u6307\u5357");
    }
  });
  on("btn-guide-close", "click", () => {
    const p = $("guide-panel");
    if (p) p.hidden = true;
  });
  (function bindGuideMask() {
    const p = $("guide-panel");
    if (!p) return;
    p.addEventListener("click", (e) => {
      if (e.target === p) p.hidden = true;
    });
  })();
  on("btn-clear-log", "click", () => {
    const box = $("log-box");
    if (box) box.innerHTML = "";
  });
  all("[data-act]").forEach((el) => {
    el.addEventListener("click", () => runAct(el.getAttribute("data-act")));
  });
  (function bindFsFloat() {
    const panel = $("fs-float");
    const handle = panel?.querySelector(".drag-handle");
    if (!panel || !handle) return;
    on("fs-toggle", "click", () => {
      panel.classList.toggle("collapsed");
    });
    let drag = null;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".fs-toggle")) return;
      const rect = panel.getBoundingClientRect();
      drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
      const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy));
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";
    });
    const end = () => drag = null;
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  })();
  function imeAutoOn() {
    const box = $("ime-auto");
    if (box) return box.checked;
    try {
      return localStorage.getItem(IME_AUTO_KEY) !== "0";
    } catch {
      return true;
    }
  }
  async function autoProvisionIme() {
    if (!textInput) return;
    try {
      let st = await textInput.status();
      if (!st.installed) {
        toast("\u9996\u6B21\u8FDE\u63A5\uFF1A\u6B63\u5728\u5B89\u88C5\u4E2D\u6587\u8F93\u5165\u63D2\u4EF6", "\u7EA6 18KB\uFF0C\u88C5\u597D\u540E\u4E2D\u6587\u53EF\u76F4\u63A5\u4E0A\u5C4F");
        const blob = await textInput.fetchBundle();
        await textInput.installFromBundle(blob, (p) => {
          if (p?.total) {
            const pct = Math.round(p.sent / p.total * 100);
            if (pct === 100) toast("\u63D2\u4EF6\u5DF2\u63A8\u9001", "\u6B63\u5728\u5B89\u88C5\u2026");
          }
        });
        st = await textInput.status();
        if (!st.installed) throw new Error("\u63D2\u4EF6\u5B89\u88C5\u540E\u672A\u68C0\u6D4B\u5230");
      }
      if (!st.enabled) await textInput.enable();
      if (imeAutoOn()) await textInput.activate();
      await refreshImeStatus();
      logLine("ok", "IME \u81EA\u52A8\u914D\u7F6E\u5B8C\u6210 installed=" + st.installed + " auto=" + imeAutoOn());
    } catch (e) {
      logLine("error", "IME \u81EA\u52A8\u914D\u7F6E\u5931\u8D25 " + String(e?.message || e));
      toast("\u4E2D\u6587\u8F93\u5165\u81EA\u52A8\u914D\u7F6E\u5931\u8D25", String(e?.message || e) + "\uFF0C\u53EF\u5728\u6587\u672C\u6846\u91CC\u624B\u52A8\u542F\u7528");
      refreshImeStatus();
    }
  }
  async function refreshImeStatus() {
    const label = $("ime-status");
    const setup = $("btn-ime-setup");
    const restore = $("btn-ime-restore");
    if (!label) return;
    if (!textInput && mirror.adb) textInput = new DeviceTextInput(mirror.adb, mirror.serialKey);
    if (!textInput) {
      label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u672A\u8FDE\u63A5\u8BBE\u5907";
      if (setup) {
        setup.disabled = true;
        setup.hidden = true;
      }
      if (restore) restore.hidden = true;
      return;
    }
    try {
      const st = await textInput.status();
      const inUse = st.current === ADB_IME_ID;
      if (!st.installed) {
        label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u672A\u5B89\u88C5\u63D2\u4EF6";
        if (setup) {
          setup.disabled = false;
          setup.hidden = false;
          setup.textContent = "\u5B89\u88C5\u4E2D\u6587\u8F93\u5165\u63D2\u4EF6";
        }
      } else if (!st.enabled) {
        label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u63D2\u4EF6\u672A\u542F\u7528";
        if (setup) {
          setup.disabled = false;
          setup.hidden = false;
          setup.textContent = "\u542F\u7528\u63D2\u4EF6";
        }
      } else if (inUse) {
        label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u4F7F\u7528\u4E2D\uFF08ADB \u8F93\u5165\u6CD5\uFF09";
        if (setup) {
          setup.disabled = true;
          setup.hidden = true;
        }
      } else {
        label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u53EF\u7528";
        if (setup) {
          setup.disabled = false;
          setup.hidden = false;
          setup.textContent = "\u5207\u6362\u5230 ADB \u8F93\u5165\u6CD5";
        }
      }
      if (restore) restore.hidden = !inUse;
    } catch (e) {
      label.textContent = "\u4E2D\u6587\u8F93\u5165\uFF1A\u68C0\u6D4B\u5931\u8D25";
      if (setup) {
        setup.disabled = false;
        setup.hidden = false;
        setup.textContent = "\u91CD\u8BD5";
      }
    }
  }
  async function ensureChineseInput({ interactive = false } = {}) {
    if (!textInput) throw new Error("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
    let st = await textInput.status();
    if (!st.installed) {
      if (interactive && !confirm("\u4E2D\u6587\u8F93\u5165\u9700\u8981\u5728\u624B\u673A\u4E0A\u88C5\u4E00\u4E2A\u5F00\u6E90\u8F93\u5165\u6CD5\u63D2\u4EF6 ADBKeyboard\uFF08\u7EA6 18KB\uFF0CGPL-2.0\uFF09\u3002\u5B89\u88C5\u5E76\u542F\u7528\uFF1F")) {
        throw new Error("\u5DF2\u53D6\u6D88\u5B89\u88C5\u4E2D\u6587\u8F93\u5165\u63D2\u4EF6");
      }
      toast("\u6B63\u5728\u5B89\u88C5\u4E2D\u6587\u8F93\u5165\u63D2\u4EF6", "\u7EA6 18KB\uFF0C\u53EA\u4F1A\u7528\u6765\u628A\u7535\u8111\u4E0A\u7684\u5B57\u9001\u8FDB\u624B\u673A\u8F93\u5165\u6846");
      const blob = await textInput.fetchBundle();
      await textInput.installFromBundle(blob, (p) => {
        if (p?.phase === "install") toast("\u6B63\u5728\u5B89\u88C5\u63D2\u4EF6", "APK \u5DF2\u63A8\u9001\uFF0C\u6B63\u5728\u5B89\u88C5\u2026");
        else if (p?.total) {
          const pct = Math.round(p.sent / p.total * 100);
          if (pct === 100 || pct % 20 === 0) toast("\u6B63\u5728\u63A8\u9001\u63D2\u4EF6", pct + "%");
        }
      });
      st = await textInput.status();
      if (!st.installed) throw new Error("\u63D2\u4EF6\u5B89\u88C5\u540E\u4ECD\u672A\u68C0\u6D4B\u5230\uFF0C\u8BF7\u91CD\u8BD5");
    }
    if (!st.enabled) await textInput.enable();
    const wasActive = !!st.active;
    await textInput.activate();
    await refreshImeStatus();
    if (!wasActive && textInput.active) {
      toast("\u4E2D\u6587\u8F93\u5165\u5DF2\u5C31\u7EEA", "\u624B\u673A\u5DF2\u5207\u5230 ADB \u8F93\u5165\u6CD5\uFF1B\u4E0D\u7528\u65F6\u70B9\u300C\u6062\u590D\u624B\u673A\u8F93\u5165\u6CD5\u300D");
    }
    return true;
  }
  async function sendTextSmart(text, { interactive = false } = {}) {
    const body = String(text ?? "");
    if (!body || !ctrl) return false;
    if (!hasNonAscii(body)) {
      await ctrl.injectText(body);
      return true;
    }
    try {
      await ensureChineseInput({ interactive });
      await textInput.send(body);
      toast("\u5DF2\u4E0A\u5C4F", body.length > 20 ? body.slice(0, 20) + "\u2026" : body);
      return true;
    } catch (e) {
      if (!interactive) {
        try {
          await ctrl.setClipboardAndPaste(body);
          toast("\u4E2D\u6587\u5DF2\u5C1D\u8BD5\u8D70\u526A\u8D34\u677F", "\u82E5\u6CA1\u4E0A\u5C4F\uFF0C\u70B9\u300C\u5B89\u88C5\u4E2D\u6587\u8F93\u5165\u63D2\u4EF6\u300D\u53EF\u5F7B\u5E95\u89E3\u51B3");
          return true;
        } catch {
        }
      }
      toast("\u4E2D\u6587\u53D1\u9001\u5931\u8D25", String(e?.message || e));
      logLine("error", "chinese send fail " + String(e?.message || e));
      return false;
    }
  }
  on("btn-ime-setup", "click", async () => {
    try {
      await ensureChineseInput({ interactive: true });
    } catch (e) {
      toast("\u542F\u7528\u5931\u8D25", String(e?.message || e));
      logLine("error", "ime setup fail " + String(e?.message || e));
    }
    refreshImeStatus();
  });
  on("btn-ime-restore", "click", async () => {
    try {
      await textInput?.restore();
      toast("\u5DF2\u6062\u590D\u624B\u673A\u8F93\u5165\u6CD5");
    } catch (e) {
      toast("\u6062\u590D\u5931\u8D25", String(e?.message || e));
    }
    refreshImeStatus();
  });
  (function bindImeAuto() {
    const box = $("ime-auto");
    if (!box) return;
    try {
      box.checked = localStorage.getItem(IME_AUTO_KEY) !== "0";
    } catch {
    }
    box.addEventListener("change", () => {
      try {
        localStorage.setItem(IME_AUTO_KEY, box.checked ? "1" : "0");
      } catch {
      }
      if (box.checked) {
        toast("\u5DF2\u5F00\u542F", "\u4E0B\u6B21\u8FDE\u63A5\u4F1A\u81EA\u52A8\u5B89\u88C5\u5E76\u542F\u7528\u4E2D\u6587\u8F93\u5165");
      } else {
        toast("\u5DF2\u5173\u95ED\u81EA\u52A8\u542F\u7528", "\u63D2\u4EF6\u4ECD\u4F1A\u5B89\u88C5\uFF0C\u4F46\u4E0D\u4F1A\u5207\u6362\u624B\u673A\u8F93\u5165\u6CD5");
        textInput?.restore().then(refreshImeStatus).catch(() => {
        });
      }
    });
  })();
  if (location.search.includes("debug")) {
    window.__ime = {
      status: () => textInput ? textInput.status() : Promise.resolve(null),
      shell: (argv) => mirror.adb?.subprocess?.noneProtocol?.spawnWaitText(argv),
      activate: () => ensureChineseInput({ interactive: false }),
      restore: () => textInput ? textInput.restore() : Promise.resolve("")
    };
    window.__ctrl = () => ctrl;
  }
  (function bindLiveTextInput() {
    const input = $("clipboard-input");
    if (!input) return;
    let last = "";
    let timer = null;
    let composing = false;
    async function sendAdd(add) {
      if (!ctrl || !add) return;
      try {
        const ok = await sendTextSmart(add, { interactive: false });
        logLine(ok ? "ok" : "error", "auto input: " + add);
      } catch (e) {
        logLine("error", "auto input fail " + String(e?.message || e));
      }
    }
    async function syncValue() {
      const next = String(input.value ?? "");
      if (next === last) return;
      if (next.length > last.length && next.startsWith(last)) {
        await sendAdd(next.slice(last.length));
      } else if (next !== last) {
        await sendAdd(next);
      }
      last = next;
      input.value = "";
      last = "";
    }
    input.addEventListener("compositionstart", () => {
      composing = true;
      clearTimeout(timer);
      logLine("log", "IME composition start");
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        syncValue();
      }, 50);
    });
    input.addEventListener("input", (e) => {
      if (composing || e.isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(syncValue, 80);
    });
    input.addEventListener("keydown", async (e) => {
      if (composing || e.isComposing) return;
      if (!ctrl) return;
      if (e.key === "Backspace") {
        try {
          await ctrl.backspace();
          logLine("ok", "auto backspace");
        } catch (err) {
          logLine("error", "backspace " + String(err?.message || err));
        }
        return;
      }
      if (e.key === "Delete") {
        try {
          await ctrl.deleteKey();
          logLine("ok", "auto delete");
        } catch (err) {
          logLine("error", "delete " + String(err?.message || err));
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        try {
          await ctrl.enter();
          logLine("ok", "auto enter");
        } catch (err) {
          logLine("error", "enter " + String(err?.message || err));
        }
      }
    });
    input.addEventListener("blur", () => {
      clearTimeout(timer);
      if (!composing) {
        last = String(input.value ?? "");
      }
    });
  })();
  on("btn-send-text", "click", async () => {
    const text = String($("clipboard-input")?.value ?? "");
    if (!text || !ctrl) return toast(text ? "\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907" : "\u8BF7\u5148\u8F93\u5165\u6587\u672C");
    try {
      const ok = await sendTextSmart(text, { interactive: true });
      if (ok) {
        logLine("ok", "send text len=" + text.length + (hasNonAscii(text) ? " non-ascii" : ""));
        const box = $("clipboard-input");
        if (box) box.value = "";
      }
    } catch (e) {
      logLine("error", "send text fail " + String(e?.message || e));
      toast("\u53D1\u9001\u5931\u8D25", String(e?.message || e));
    }
  });
  on("btn-copy-dev", "click", async () => {
    const text = String($("clipboard-input")?.value ?? "");
    if (!text || !ctrl) return toast(text ? "\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907" : "\u8BF7\u5148\u8F93\u5165\u6587\u672C");
    await ctrl.setClipboard(text);
    toast("\u5DF2\u590D\u5236\u5230\u8BBE\u5907\u526A\u8D34\u677F");
  });
  on("btn-paste-dev", "click", async () => {
    const text = String($("clipboard-input")?.value ?? "");
    if (!text || !ctrl) return toast(text ? "\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907" : "\u8BF7\u5148\u8F93\u5165\u6587\u672C");
    await ctrl.setClipboardAndPaste(text);
    toast("\u5DF2\u53D1\u9001\u5E76\u7C98\u8D34");
  });
  function clipPreview(text) {
    const t = String(text ?? "");
    return t.length > 40 ? t.slice(0, 40) + "\u2026" : t;
  }
  on("btn-pc2dev", "click", async () => {
    if (!ctrl) return toast("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast("\u7535\u8111\u526A\u8D34\u677F\u4E3A\u7A7A");
      await ctrl.setClipboardAndPaste(text);
      toast("\u7535\u8111\u526A\u8D34\u677F\u5DF2\u7C98\u8D34\u5230\u624B\u673A", clipPreview(text));
      logLine("ok", "clipboard pc\u2192dev len=" + text.length);
    } catch (e) {
      logLine("error", "pc\u2192dev " + String(e?.message || e));
      toast(
        "\u8BFB\u53D6\u7535\u8111\u526A\u8D34\u677F\u5931\u8D25",
        "\u6D4F\u89C8\u5668\u672A\u6388\u6743\u526A\u8D34\u677F\u8BFB\u53D6,\u53EF\u5148 Ctrl+C \u590D\u5236\u3001\u70B9\u7F51\u9875\u4E00\u6B21\u540E\u518D\u8BD5,\u6216\u7C98\u8D34\u5230\u8F93\u5165\u6846\u53D1\u9001"
      );
    }
  });
  on("btn-dev2pc", "click", async () => {
    if (!ctrl) return toast("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
    try {
      const text = await ctrl.getDeviceClipboard();
      if (text == null) {
        toast("\u672A\u8BFB\u5230\u624B\u673A\u526A\u8D34\u677F", "\u8BF7\u5148\u5728\u624B\u673A\u4E0A\u590D\u5236\u6587\u672C,\u518D\u70B9\u6B64\u6309\u94AE");
        return;
      }
      await navigator.clipboard.writeText(text);
      const box = $("clipboard-input");
      if (box) box.value = text;
      toast("\u624B\u673A\u526A\u8D34\u677F\u5DF2\u590D\u5236\u5230\u7535\u8111", clipPreview(text));
      logLine("ok", "clipboard dev\u2192pc len=" + String(text).length);
    } catch (e) {
      logLine("error", "dev\u2192pc " + String(e?.message || e));
      toast("\u8BFB\u53D6\u624B\u673A\u526A\u8D34\u677F\u5931\u8D25", String(e?.message || e));
    }
  });
  (function bindFsInput() {
    const box = $("fs-input");
    if (!box) return;
    let last = "";
    let timer = null;
    let composing = false;
    async function sendAdd(add) {
      if (!ctrl || !add) return;
      try {
        const ok = await sendTextSmart(add, { interactive: false });
        logLine(ok ? "ok" : "error", "fs auto: " + add);
      } catch (e) {
        logLine("error", "fs auto fail " + String(e?.message || e));
      }
    }
    async function syncValue(clear) {
      const next = String(box.value ?? "");
      if (next === last) return;
      if (next.length > last.length && next.startsWith(last)) {
        await sendAdd(next.slice(last.length));
      } else if (next !== last) {
        await sendAdd(next);
      }
      last = clear ? "" : next;
      if (clear) box.value = "";
    }
    box.addEventListener("compositionstart", () => {
      composing = true;
      clearTimeout(timer);
    });
    box.addEventListener("compositionend", () => {
      composing = false;
      clearTimeout(timer);
      timer = setTimeout(() => syncValue(true), 50);
    });
    box.addEventListener("input", (e) => {
      if (composing || e.isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(() => syncValue(true), 120);
    });
    const sendNow = async () => {
      const text = String(box.value ?? "");
      if (!text) return;
      if (!ctrl) {
        toast("\u8BF7\u5148\u8FDE\u63A5\u8BBE\u5907");
        return;
      }
      try {
        const ok = await sendTextSmart(text, { interactive: true });
        if (!ok) return;
        box.value = "";
        last = "";
        logLine("ok", "fs send " + text.length);
      } catch (e) {
        logLine("error", "fs send " + String(e?.message || e));
        toast("\u53D1\u9001\u5931\u8D25", String(e?.message || e));
      }
    };
    box.addEventListener("keydown", async (e) => {
      if (composing || e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await sendNow();
        return;
      }
      if (!ctrl) return;
      if (e.key === "Backspace") {
        try {
          await ctrl.backspace();
        } catch {
        }
      }
    });
  })();
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("beforeunload", saveSettings);
  window.addEventListener("pagehide", () => {
    usbManualStop = true;
    clearTimeout(usbRetryTimer);
    clearTimeout(usbStableTimer);
    stopUsbGuard();
    try {
      textInput?.restore();
    } catch {
    }
    try {
      mirror.stop();
    } catch {
    }
  });
  (async () => {
    applySettings(loadSettings());
    bindSettingsSaver();
    try {
      const d = await new AdbMirror({ stage: $("stage") }).diagnose();
      logLine(
        "info",
        "\u73AF\u5883 WebUSB=" + d.webusb + " secure=" + d.secure + " devices=" + d.authorizedDevices + " codecs=" + d.webcodecs
      );
    } catch {
    }
    decorateIcons();
    await refreshUsbDevices(true);
    mirror.prefetchServerJar();
    logLine("info", "\u9875\u9762\u5DF2\u5C31\u7EEA \xB7 \u8BBE\u7F6E\u5DF2\u52A0\u8F7D");
    try {
      const st = await (await fetch("/api/status", { cache: "no-store" })).json();
      const rv = document.getElementById("rail-ver");
      if (rv && st && st.version) rv.textContent = String(st.version);
    } catch {
    }
  })();
  window.addEventListener("keydown", (e) => {
    const tag = (e.target?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
    if (e.key === "Escape" && e.shiftKey) {
      $("btn-stop")?.click();
      return;
    }
    if (typing) return;
    if (e.key === "h" || e.key === "H") {
      toggleFullscreen();
    } else if (e.key === "m" || e.key === "M") {
      $("btn-mute")?.click();
    }
  });
})();
/*! Bundled license information:

yuv-canvas/src/depower.js:
  (**
   * Convert a ratio into a bit-shift count; for instance a ratio of 2
   * becomes a bit-shift of 1, while a ratio of 1 is a bit-shift of 0.
   *
   * @author Brooke Vibber <bvibber@pobox.com>
   * @copyright 2016-2024
   * @license MIT-style
   *
   * @param {number} ratio - the integer ratio to convert.
   * @returns {number} - number of bits to shift to multiply/divide by the ratio.
   * @throws exception if given a non-power-of-two
   *)

yuv-canvas/src/YCbCr.js:
  (**
   * Basic YCbCr->RGB conversion
   *
   * @author Brooke Vibber <bvibber@pobox.com>
   * @copyright 2014-2024
   * @license MIT-style
   *
   * @param {YUVFrame} buffer - input frame buffer
   * @param {Uint8ClampedArray} output - array to draw RGBA into
   * Assumes that the output array already has alpha channel set to opaque.
   *)
*/
//# sourceMappingURL=mirror.bundle.js.map
