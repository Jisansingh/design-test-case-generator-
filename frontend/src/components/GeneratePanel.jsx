import { useState } from 'react'
import './GeneratePanel.css'

function GeneratePanel({ isGenerating, onGenerate }) {
  const [designDescription, setDesignDescription] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!designDescription.trim()) return
    onGenerate(designDescription)
  }

  return (
    <section className="panel panel-left">
      <h2 className="panel-title">Design Description</h2>

      <form className="generate-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="design-description">
            Describe the feature or design you want to test
          </label>
          <textarea
            id="design-description"
            className="form-textarea"
            placeholder="e.g. A login form with email and password fields, validation, and a submit button..."
            rows={10}
            value={designDescription}
            onChange={(e) => setDesignDescription(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isGenerating || !designDescription.trim()}
          >
            {isGenerating ? (
              <span className="btn-loading">
                <span className="spinner" />
                Generating & Running Tests...
              </span>
            ) : (
              'Generate & Run Tests'
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

export default GeneratePanel
