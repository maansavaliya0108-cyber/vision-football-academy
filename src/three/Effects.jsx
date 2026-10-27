import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { director } from './director'

const GLOW = 0.95

/** Glow and vignette. Split into its own chunk: phones skip these effects, so they never download them. */
export default function Effects() {
  const bloom = useRef(null)
  // The glow flares with each hit (the burst, the pass, the landing) and settles back.
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = GLOW + director.flash * 1.4
  })
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <Bloom ref={bloom} mipmapBlur intensity={GLOW} luminanceThreshold={0.18} luminanceSmoothing={0.4} radius={0.72} />
      <Vignette offset={0.2} darkness={0.85} />
    </EffectComposer>
  )
}
