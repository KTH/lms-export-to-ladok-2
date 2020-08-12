import React, { useEffect } from 'react'
/**
 * Component to choose one module
 * - modules. list of "modules" the user can choose from
 * - onChange(i). Triggered when the user chooses something.
 *      Argument `i` is the index of the list
 * - value. Index on the list to show as selection
 */
export default function ModuleSelector ({ modules, onChange, value }) {
  useEffect(() => {
    if (modules.length === 1) {
      onChange(0)
    }
  })
  if (modules.length === 1) {
    return (
      <div className='select-wrapper'>
        <select
          className='custom-select'
          name='ladok_module'
          value={value}
          disabled
        >
          <option value={-1} disabled hidden>
            {modules[0].code} - ({modules[0].name.en} / {modules[0].name.sv})
          </option>
        </select>
      </div>
    )
  }
  return (
    <div className='select-wrapper'>
      <select
        className='custom-select'
        name='ladok_module'
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        <option value={-1} disabled hidden>
          Select Ladok module
        </option>
        {modules.map((module, i) => {
          return (
            <option key={i} value={i}>
              {module.code} - ({module.name.en} / {module.name.sv})
            </option>
          )
        })}
      </select>
    </div>
  )
}
