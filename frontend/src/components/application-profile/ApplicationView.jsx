import { useParams } from "react-router-dom"

import ConsumerApplicationView from "./ConsumerApplicationView"
import VehicleApplicationView from "./VehicleApplicationView"
import { getApplication } from "./storage"

export default function ApplicationView() {
  const { applicationId } = useParams()
  const application = getApplication(applicationId)

  if (application?.loanType === "hire-purchase") {
    return <VehicleApplicationView />
  }

  return <ConsumerApplicationView />
}
