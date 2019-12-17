import React, { useState } from 'react'
import { useLazyFetch } from './react-hooks'
import Form from './Form'
import FeedbackTable from './FeedbackTable'

function Loading () {
  return <div>Sending data to Ladok…</div>
}

function App ({ courseId }) {
  const [showForm, setShowForm] = useState(true)
  const [{ data, loading, error }, doFetch] = useLazyFetch()

  function submitHandler ({
    selectedAssignment,
    selectedModule,
    examinationDate
  }) {
    setShowForm(false)

    doFetch(`api/export`, {
      method: 'POST',
      body: JSON.stringify({
        course_id: courseId,
        canvas_assignment: selectedAssignment,
        ladok_module: selectedModule,
        examination_date: examinationDate
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  if (showForm) {
    return <Form courseId={courseId} onSubmit={submitHandler} />
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <div>Error when exporting</div>
  }

  return <FeedbackTable data={data} />
}

export default App
