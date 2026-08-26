import{t as e}from"./shaderStore-T2b-z9pM.js";var t=`pointCloudVertex`,n=`#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
`;e.IncludesShadersStore[t]||(e.IncludesShadersStore[t]=n);