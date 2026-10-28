import{t as e}from"./shaderStore-XzOL7o8K.js";import"./helperFunctions-B1E1D1Pi.js";var t=`rgbdEncodePixelShader`,n=`varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=toRGBD(textureSample(textureSampler,textureSamplerSampler,input.vUV).rgb);}`;e.ShadersStoreWGSL[t]||(e.ShadersStoreWGSL[t]=n);const r={name:t,shader:n};export{r as rgbdEncodePixelShaderWGSL};