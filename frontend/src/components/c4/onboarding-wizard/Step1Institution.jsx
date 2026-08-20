import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const SRI_LANKAN_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Moneragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
].sort()

export const INSTITUTION_TYPES = [
  "Licensed Finance Company",
  "Microfinance NGO",
  "Rural Development Bank",
  "Co-operative Society"
]

export default function Step1Institution({ formData, errors, handleInputChange }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="institutionName" className="text-sm font-medium">
            Institution Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="institutionName"
            value={formData.institutionName}
            onChange={(e) => handleInputChange("institutionName", e.target.value)}
            placeholder="e.g. Sarvodaya Micro Lending"
            className={`h-9 ${errors.institutionName ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
          />
          {errors.institutionName && (
            <p className="text-xs text-destructive font-medium">{errors.institutionName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registrationNumber" className="text-sm font-medium">
            Registration Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="registrationNumber"
            value={formData.registrationNumber}
            onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
            placeholder="e.g. PV-12345 or GA/NGO/88"
            className={`h-9 ${errors.registrationNumber ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
          />
          {errors.registrationNumber && (
            <p className="text-xs text-destructive font-medium">{errors.registrationNumber}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label htmlFor="institutionType" className="text-sm font-medium">
            Institution Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="institutionType"
            value={formData.institutionType}
            onChange={(e) => handleInputChange("institutionType", e.target.value)}
            className={`flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50
              ${errors.institutionType ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
          >
            <option value="" disabled>Select type...</option>
            {INSTITUTION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {errors.institutionType && (
            <p className="text-xs text-destructive font-medium">{errors.institutionType}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="district" className="text-sm font-medium">
            District (Sri Lanka) <span className="text-destructive">*</span>
          </Label>
          <select
            id="district"
            value={formData.district}
            onChange={(e) => handleInputChange("district", e.target.value)}
            className={`flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50
              ${errors.district ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
          >
            <option value="" disabled>Select district...</option>
            {SRI_LANKAN_DISTRICTS.map((dist) => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
          {errors.district && (
            <p className="text-xs text-destructive font-medium">{errors.district}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="numBranches" className="text-sm font-medium">
            Number of Branches
          </Label>
          <Input
            id="numBranches"
            type="number"
            min="1"
            value={formData.numBranches}
            onChange={(e) => handleInputChange("numBranches", e.target.value)}
            className={`h-9 ${errors.numBranches ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
          />
          {errors.numBranches && (
            <p className="text-xs text-destructive font-medium">{errors.numBranches}</p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-border/50">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-4">
          Primary Contact Administrator
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <Label htmlFor="contactName" className="text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactName"
              value={formData.contactName}
              onChange={(e) => handleInputChange("contactName", e.target.value)}
              placeholder="e.g. Ruwan Perera"
              className={`h-9 ${errors.contactName ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
            {errors.contactName && (
              <p className="text-xs text-destructive font-medium">{errors.contactName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => handleInputChange("contactEmail", e.target.value)}
              placeholder="ruwan@institution.lk"
              className={`h-9 ${errors.contactEmail ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
            {errors.contactEmail && (
              <p className="text-xs text-destructive font-medium">{errors.contactEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="text-sm font-medium">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactPhone"
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => handleInputChange("contactPhone", e.target.value)}
              placeholder="e.g. 0771234567"
              className={`h-9 ${errors.contactPhone ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
            {errors.contactPhone && (
              <p className="text-xs text-destructive font-medium">{errors.contactPhone}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
