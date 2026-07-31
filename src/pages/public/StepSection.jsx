import React from "react";
import "./StepSection.css";

import step1 from "../../assets/steps-imgs/step1.png";
import step2 from "../../assets/steps-imgs/step2.png";
import step3 from "../../assets/steps-imgs/step3.png";
import step4 from "../../assets/steps-imgs/step4.png";


function StepSection() {
  return (
    <section id="how-it-works" className="steps-section">
      <h2 className="steps-title">How it works in four simple steps</h2>
      <p className="steps-subtitle">
        Automated workflow for smarter car wash operations.
      </p>

      <div className="steps-grid">
        <div className="step-card">
          <h3>Step 1</h3>

          <p className="step-description">
            <strong>Scan QR & Request a Wash</strong> - Scan the QR code and
            instantly create a car wash request. No calls, no waiting.
          </p>

          <div className="step-image">
            <img src={step1} alt="Step 1" />
          </div>
        </div>

        <div className="step-card">
          <h3>Step 2</h3>

          <p className="step-description">
            <strong>Job Assignment</strong> - The system automatically creates a
            service job and it will prepares it for execution.
          </p>

          <div className="step-image">
            <img src={step2} alt="Step 2" />
          </div>
        </div>

        <div className="step-card">
          <h3>Step 3</h3>

          <p className="step-description">
            <strong>Assign to Available Washer</strong> - The nearest available washer is assigned to the job for faster service and efficient operations.
          </p>

          <div className="step-image">
            <img src={step3} alt="Step 3" />
          </div>

        </div><div className="step-card">
          <h3>Step 4</h3>

          <p className="step-description">
            <strong>Wash Completed</strong> - Receive confirmation once the wash is completed successfully, along with service and payment details.
          </p>

          <div className="step-image">
            <img src={step4} alt="Step 4" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default StepSection;
