import { useState } from "react"

import { getOfficerTrustSnapshot } from "./adaptive-explanation"
import {
  getExplanationStyleId,
  setExplanationStyleId,
} from "./officer-profile-style"

export function useOfficerExplanationStyle() {
  const [styleId, setStyleIdState] = useState(() => getExplanationStyleId())

  function setStyleId(nextStyleId) {
    setExplanationStyleId(nextStyleId)
    setStyleIdState(nextStyleId)
  }

  const trust = getOfficerTrustSnapshot(styleId)

  return { styleId, setStyleId, trust }
}
