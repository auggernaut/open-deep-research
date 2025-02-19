import React from 'react'
import { ReportContent } from './report-content'

interface PageProps {
  params: {
    id: string
  }
}

export default function ReportPage({ params }: PageProps) {
  return <ReportContent id={params.id} />
}
