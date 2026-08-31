import { useParams } from "react-router-dom"

import ConsumerApplicationWizard from "./ConsumerApplicationWizard"
import VehicleApplicationWizard from "./VehicleApplicationWizard"
import { getApplication } from "./storage"

export default function ApplicationWizard() {
  const { loanType, applicationId } = useParams()
  const resolvedType = loanType || getApplication(applicationId)?.loanType

  if (resolvedType === "hire-purchase") {
    return <VehicleApplicationWizard />
  }

  return <ConsumerApplicationWizard />
}
