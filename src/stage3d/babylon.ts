/**
 * The ONE place Babylon is imported from, and the only file allowed to do it.
 *
 * Two reasons, and the second is the one that matters:
 *
 *  1. **Tree shaking.** `@babylonjs/core` is ~4 MB of source. Importing the
 *     barrel (`from '@babylonjs/core'`) pulls the whole engine — WebGPU, the
 *     physics plugins, the glTF loaders, the inspector hooks — into a bundle
 *     that is otherwise a Vue app. Every import below is a deep path to exactly
 *     one thing, which is the documented way to keep it to what is used.
 *
 *  2. **Nothing else in the app may reach for a different one.** A second
 *     import path for `Vector3` is a second copy of the maths module in the
 *     bundle and, worse, `instanceof` stops working between them. Naming them
 *     once here is what makes that impossible rather than merely unlikely.
 *
 * **This module is never statically imported by a view.** Every consumer
 * reaches it through `await import('./babylon')` inside `loadStage3d()` — see
 * `loader.ts` — so a reader who never opens the Newscast, the meeting or an
 * interview never downloads the renderer at all. That is also why nothing here
 * is exported as a value the rest of the app can type against: the types come
 * from `@babylonjs/core` directly (a type-only import is erased at build time
 * and costs nothing), and the runtime objects come from the promise.
 */

// Side-effect imports. Babylon registers scene components through module side
// effects, and without these the feature is simply absent at runtime with no
// error — a shadow generator that casts nothing, a material that renders black.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';

export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { Vector3, Vector2, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Viewport } from '@babylonjs/core/Maths/math.viewport';
export { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { SpotLight } from '@babylonjs/core/Lights/spotLight';
export { PointLight } from '@babylonjs/core/Lights/pointLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
export { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
export { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
export { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
export { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
export { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
export { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
export { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
export { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
export { CreateLathe } from '@babylonjs/core/Meshes/Builders/latheBuilder';
export { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export { Texture } from '@babylonjs/core/Materials/Textures/texture';
export { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
export { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
