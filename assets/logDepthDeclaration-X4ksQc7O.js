import{t as e}from"./shaderStore-TtV58TPX.js";var t=`mainUVVaryingDeclaration`,n=`#ifdef MAINUV{X}
varying vec2 vMainUV{X};
#endif
`;e.IncludesShadersStore[t]||(e.IncludesShadersStore[t]=n);var r=`logDepthDeclaration`,i=`#ifdef LOGARITHMICDEPTH
uniform float logarithmicDepthConstant;varying float vFragmentDepth;
#endif
`;e.IncludesShadersStore[r]||(e.IncludesShadersStore[r]=i);