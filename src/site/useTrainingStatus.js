import { useEffect, useState } from 'react'
import { academyClock, trainingStatus } from '../../shared/schedule.js'

export function useTrainingStatus() {
  const [status, setStatus] = useState(() => ({ ...trainingStatus(), today: academyClock().dow }))
  useEffect(() => {
    const tick = () => setStatus({ ...trainingStatus(), today: academyClock().dow })
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return status
}
