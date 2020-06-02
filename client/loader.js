import React from 'react'

const Reason = (currentPage, reason) => {
  switch (currentPage) {
    case 0:
      return 'Cancelling request ...'
    case 1:
      return 'Loading assignment and date (Step 1 of 2) ...'
    case 2:
      return 'Loading transfer grades (Step 2 of 2) ...'
    default:
      return reason
  }
}

const Loader = ({ currentPage = null, reason = 'Loading ...' }) => {
  return (
    <>
      <div className='loader' />
      <p className='loader-text'>{Reason(currentPage, reason)}</p>
    </>
  )
}

export default Loader
