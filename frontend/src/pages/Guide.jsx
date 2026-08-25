import React from "react";
import "./Guide.css";

/* =========================================================
   GUIDE STEPS
========================================================= */

const steps = [
  {
    number: "01",
    icon: "bi-box-arrow-in-right",
    title: "Login",
    shortTitle: "Sign in",
    description:
      "Sign in to ToolWear.AI using your operator account.",
    instruction:
      "After successful login, you will be taken directly to the Machines page.",
    screen: "LOGIN",
  },

  {
    number: "02",
    icon: "bi-cpu",
    title: "Select a Machine",
    shortTitle: "Choose machine",
    description:
      "The Machines page shows the CNC machines available to you.",
    instruction:
      'Find the machine you want to monitor and click the "View" button.',
    screen: "MACHINES",
  },

  {
    number: "03",
    icon: "bi-grid-1x2",
    title: "Open Dashboard",
    shortTitle: "View dashboard",
    description:
      "After selecting a machine, the Dashboard becomes available.",
    instruction:
      "Use the dashboard to check the current tool-wear condition and prediction results.",
    screen: "DASHBOARD",
  },

  {
    number: "04",
    icon: "bi-cloud-arrow-up",
    title: "Upload Data",
    shortTitle: "Upload data",
    description:
      "Provide the tool image and, when required, the telemetry or sensor data.",
    instruction:
      "Select the required files and enter the machining pass information.",
    screen: "UPLOAD",
  },

  {
    number: "05",
    icon: "bi-stars",
    title: "Run AI Prediction",
    shortTitle: "Run prediction",
    description:
      "The AI model analyzes the uploaded information to estimate tool wear and health.",
    instruction:
      'Click "Run Prediction" and wait for the analysis to complete.',
    screen: "AI",
  },

  {
    number: "06",
    icon: "bi-bar-chart-line",
    title: "Review Results",
    shortTitle: "Review results",
    description:
      "Review wear, health, confidence, telemetry and explainability information.",
    instruction:
      "Use the sidebar pages to investigate the machine and tool condition in detail.",
    screen: "RESULTS",
  },
];

/* =========================================================
   RESULT PAGES
========================================================= */

const resultPages = [
  {
    icon: "bi-grid-1x2",
    title: "Dashboard",
    description:
      "View the overall machine and tool-health condition.",
  },

  {
    icon: "bi-stars",
    title: "Explainable AI",
    description:
      "Understand which information contributed to the AI prediction.",
  },

  {
    icon: "bi-graph-up-arrow",
    title: "Wear Progression",
    description:
      "Track how tool wear changes across machining cycles.",
  },

  {
    icon: "bi-activity",
    title: "Telemetry",
    description:
      "Inspect available sensor and telemetry information.",
  },

  {
    icon: "bi-cpu",
    title: "Machine Specs",
    description:
      "Review machine and tooling specifications.",
  },
];

/* =========================================================
   VISUAL SCREEN MOCKUPS
========================================================= */

function LoginMockup() {
  return (
    <div className="guide-screen guide-login-screen">

      <div className="guide-browser-bar">
        <span />
        <span />
        <span />
      </div>

      <div className="guide-login-body">

        <div className="guide-login-logo">
          <i className="bi bi-crosshair2" />
        </div>

        <strong>ToolWear.AI</strong>

        <small>
          CNC PHM Suite
        </small>

        <div className="guide-input-mock">
          Operator email
        </div>

        <div className="guide-input-mock">
          Password
        </div>

        <div className="guide-button-mock">
          Sign In
        </div>

      </div>

    </div>
  );
}

function MachinesMockup() {
  return (
    <div className="guide-screen">

      <div className="guide-mock-header">
        <div>
          <small>Machines</small>
          <strong>Machine Registry</strong>
        </div>

        <div className="guide-search-mock">
          <i className="bi bi-search" />
          Search machine
        </div>
      </div>

      <div className="guide-machine-row guide-machine-heading">
        <span>Machine</span>
        <span>Status</span>
        <span>Action</span>
      </div>

      <div className="guide-machine-row">
        <div>
          <strong>RFM760</strong>
          <small>MCH-001</small>
        </div>

        <span className="guide-online">
          ● Online
        </span>

        <button className="guide-view-mock">
          View
        </button>
      </div>

      <div className="guide-machine-row">
        <div>
          <strong>RFM520</strong>
          <small>MCH-002</small>
        </div>

        <span className="guide-offline">
          ● Offline
        </span>

        <button className="guide-view-mock">
          View
        </button>
      </div>

    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="guide-screen">

      <div className="guide-dashboard-top">
        <div>
          <small>Selected Machine</small>
          <strong>RFM760</strong>
        </div>

        <span className="guide-online">
          ● Online
        </span>
      </div>

      <div className="guide-dashboard-cards">

        <div>
          <small>Tool Wear</small>
          <strong>42 μm</strong>
        </div>

        <div>
          <small>Health</small>
          <strong>87%</strong>
        </div>

        <div>
          <small>Confidence</small>
          <strong>94%</strong>
        </div>

      </div>

      <div className="guide-chart-mock">

        <div className="guide-chart-line line-one" />
        <div className="guide-chart-line line-two" />
        <div className="guide-chart-line line-three" />

        <div className="guide-chart-axis" />

      </div>

    </div>
  );
}

function UploadMockup() {
  return (
    <div className="guide-screen guide-upload-screen">

      <div className="guide-upload-title">
        <i className="bi bi-cloud-arrow-up" />

        <div>
          <strong>Prediction Data</strong>
          <small>
            Upload tool and telemetry data
          </small>
        </div>
      </div>

      <div className="guide-upload-box">

        <i className="bi bi-image" />

        <strong>
          Tool Image
        </strong>

        <small>
          Choose image file
        </small>

        <button>
          Browse Image
        </button>

      </div>

      <div className="guide-upload-box">

        <i className="bi bi-activity" />

        <strong>
          Sensor / Telemetry
        </strong>

        <small>
          Optional telemetry file
        </small>

        <button>
          Browse File
        </button>

      </div>

      <div className="guide-pass-row">

        <span>
          Machining Pass
        </span>

        <div>
          1
        </div>

      </div>

    </div>
  );
}

function AIMockup() {
  return (
    <div className="guide-screen guide-ai-screen">

      <div className="guide-ai-heading">

        <div className="guide-ai-icon">
          <i className="bi bi-stars" />
        </div>

        <div>
          <small>AI Analysis</small>
          <strong>
            Prediction Complete
          </strong>
        </div>

      </div>

      <div className="guide-ai-result">

        <div>
          <small>Predicted Wear</small>
          <strong>42 μm</strong>
        </div>

        <div>
          <small>Health Score</small>
          <strong>87%</strong>
        </div>

      </div>

      <div className="guide-ai-status">
        <span />
        Tool condition: Healthy
      </div>

      <div className="guide-prediction-bar">
        <span />
      </div>

    </div>
  );
}

function ResultsMockup() {
  return (
    <div className="guide-screen guide-results-screen">

      <div className="guide-results-sidebar">

        <div className="guide-mini-brand">
          <i className="bi bi-crosshair2" />
        </div>

        <span className="active">
          <i className="bi bi-grid-1x2" />
        </span>

        <span>
          <i className="bi bi-stars" />
        </span>

        <span>
          <i className="bi bi-graph-up-arrow" />
        </span>

        <span>
          <i className="bi bi-activity" />
        </span>

        <span>
          <i className="bi bi-cpu" />
        </span>

      </div>

      <div className="guide-results-main">

        <small>
          MACHINE RFM760
        </small>

        <strong>
          Tool Health Overview
        </strong>

        <div className="guide-result-grid">

          <div>
            <span>Wear</span>
            <strong>42 μm</strong>
          </div>

          <div>
            <span>Health</span>
            <strong>87%</strong>
          </div>

        </div>

        <div className="guide-result-chart">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   SCREEN SELECTOR
========================================================= */

function StepScreen({ screen }) {
  switch (screen) {
    case "LOGIN":
      return <LoginMockup />;

    case "MACHINES":
      return <MachinesMockup />;

    case "DASHBOARD":
      return <DashboardMockup />;

    case "UPLOAD":
      return <UploadMockup />;

    case "AI":
      return <AIMockup />;

    case "RESULTS":
      return <ResultsMockup />;

    default:
      return null;
  }
}

/* =========================================================
   MAIN GUIDE PAGE
========================================================= */

export default function Guide() {
  return (
    <div className="guide-page">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <header className="guide-header">

        <div className="guide-header-content">

          <div className="guide-kicker">
            <i className="bi bi-book" />
            User Guide
          </div>

          <h1>
            How to use ToolWear.AI
          </h1>

          <p>
            Follow this visual workflow to monitor your
            CNC machine, analyze tool wear and review
            AI-powered predictive maintenance results.
          </p>

        </div>

        <div className="guide-header-icon">
          <i className="bi bi-compass" />
        </div>

      </header>


      {/* =================================================
          QUICK WORKFLOW
      ================================================= */}

      <section className="guide-workflow-section">

        <div className="guide-section-heading">

          <div>
            <span>
              QUICK START
            </span>

            <h2>
              Your workflow at a glance
            </h2>

            <p>
              Follow these six steps from login to
              reviewing your prediction.
            </p>
          </div>

        </div>


        <div className="guide-workflow">

          {steps.map((step, index) => (
            <React.Fragment key={step.number}>

              <div className="guide-workflow-step">

                <div className="guide-workflow-number">
                  {step.number}
                </div>

                <div className="guide-workflow-icon">
                  <i className={`bi ${step.icon}`} />
                </div>

                <strong>
                  {step.shortTitle}
                </strong>

              </div>

              {index < steps.length - 1 && (
                <div className="guide-workflow-arrow">
                  <i className="bi bi-arrow-right" />
                </div>
              )}

            </React.Fragment>
          ))}

        </div>

      </section>


      {/* =================================================
          DETAILED STEPS
      ================================================= */}

      <section className="guide-steps-section">

        <div className="guide-section-heading">

          <div>
            <span>
              STEP-BY-STEP
            </span>

            <h2>
              Follow the visual instructions
            </h2>

            <p>
              Each section below shows what you should
              see and what action to take.
            </p>
          </div>

        </div>


        <div className="guide-step-list">

          {steps.map((step, index) => (

            <article
              className="guide-step-card"
              key={step.number}
            >

              {/* LEFT SIDE */}

              <div className="guide-step-information">

                <div className="guide-step-number">
                  {step.number}
                </div>

                <div className="guide-step-title-row">

                  <div className="guide-step-icon">
                    <i
                      className={`bi ${step.icon}`}
                    />
                  </div>

                  <div>
                    <span>
                      STEP {step.number}
                    </span>

                    <h3>
                      {step.title}
                    </h3>
                  </div>

                </div>

                <p className="guide-step-description">
                  {step.description}
                </p>

                <div className="guide-action-box">

                  <i className="bi bi-lightbulb" />

                  <div>
                    <strong>
                      What to do
                    </strong>

                    <p>
                      {step.instruction}
                    </p>
                  </div>

                </div>

              </div>


              {/* RIGHT SIDE */}

              <div className="guide-step-visual">

                <div className="guide-visual-label">
                  <i className="bi bi-display" />
                  What you will see
                </div>

                <StepScreen
                  screen={step.screen}
                />

              </div>

            </article>

          ))}

        </div>

      </section>


      {/* =================================================
          AVAILABLE PAGES
      ================================================= */}

      <section className="guide-pages-section">

        <div className="guide-section-heading">

          <div>
            <span>
              NAVIGATION
            </span>

            <h2>
              Understand the monitoring pages
            </h2>

            <p>
              After selecting a machine, these pages
              become available from the sidebar.
            </p>
          </div>

        </div>


        <div className="guide-pages-grid">

          {resultPages.map((page, index) => (

            <div
              className="guide-page-card"
              key={page.title}
            >

              <div className="guide-page-card-top">

                <div className="guide-page-icon">
                  <i
                    className={`bi ${page.icon}`}
                  />
                </div>

                <span>
                  0{index + 1}
                </span>

              </div>

              <h3>
                {page.title}
              </h3>

              <p>
                {page.description}
              </p>

            </div>

          ))}

        </div>

      </section>


      {/* =================================================
          IMPORTANT RULE
      ================================================= */}

      <section className="guide-rule-card">

        <div className="guide-rule-icon">
          <i className="bi bi-info-circle" />
        </div>

        <div>

          <span>
            IMPORTANT
          </span>

          <h2>
            Select a machine before monitoring
          </h2>

          <p>
            When you first log in, the Machines page is
            the only application page available. The
            monitoring navigation appears after you click
            <strong> View </strong>
            on a specific machine.
          </p>

        </div>

      </section>


      {/* =================================================
          FINAL WORKFLOW
      ================================================= */}

      <section className="guide-final-section">

        <div className="guide-final-content">

          <span>
            COMPLETE WORKFLOW
          </span>

          <h2>
            Login → Machine → Prediction → Insight
          </h2>

          <p>
            Select your machine, analyze tool condition
            and use the monitoring pages to make informed
            maintenance decisions.
          </p>

        </div>


        <div className="guide-final-flow">

          <div>
            <i className="bi bi-person-check" />
            <strong>Login</strong>
          </div>

          <i className="bi bi-arrow-right" />

          <div>
            <i className="bi bi-cpu" />
            <strong>Machine</strong>
          </div>

          <i className="bi bi-arrow-right" />

          <div>
            <i className="bi bi-stars" />
            <strong>AI Prediction</strong>
          </div>

          <i className="bi bi-arrow-right" />

          <div>
            <i className="bi bi-bar-chart-line" />
            <strong>Insight</strong>
          </div>

        </div>

      </section>

    </div>
  );
}