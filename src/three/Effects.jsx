import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** Glow and vignette. Split into its own chunk: phones skip these effects, so they never download them. */
export default function Effects() {
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.18} luminanceSmoothing={0.4} radius={0.72} />
      <Vignette offset={0.2} darkness={0.85} />
    </EffectComposer>
  )
}
