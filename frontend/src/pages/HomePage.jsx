import React from "react";
import "./HomePage.css";
import logo from "../../../gesturify_logo.png";

export default function HomePage({
  onSignIn,
  isLoading = false,
  authError = null,
}) {
  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="home-logo">
          <img src={logo} alt="Gesturify logo" className="logo-img" />
          <span className="logo-text">Gesturify</span>
        </div>
        <button
          onClick={onSignIn}
          disabled={isLoading}
          className="btn-sign-in-header"
        >
          {isLoading ? "Loading..." : "SIGN IN"}
        </button>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="home-container">
          <div className="home-illustration">
            <div className="illustration-emoji">🤚</div>
            <div className="illustration-emoji">✌️</div>
            <div className="illustration-emoji">👌</div>
            <div className="illustration-emoji">🤟</div>
            <div className="illustration-emoji large">👋</div>
          </div>

          <div className="home-content">
            <h1 className="home-title">
              The free, fun, and effective way to learn sign language!
            </h1>

            <div className="home-actions">
              <button
                onClick={onSignIn}
                disabled={isLoading}
                className="btn-get-started"
              >
                {isLoading ? "LOADING..." : "GET STARTED"}
              </button>

              <button
                onClick={onSignIn}
                disabled={isLoading}
                className="btn-sign-in"
              >
                {isLoading ? "LOADING..." : "I ALREADY HAVE AN ACCOUNT"}
              </button>

              {authError && (
                <div className="home-error">
                  {String(authError?.message || authError)}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
