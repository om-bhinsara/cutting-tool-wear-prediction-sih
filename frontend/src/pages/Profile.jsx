import React, { useEffect, useState } from "react";
import "./Profile.css";

const PROFILE_KEY = "phm_operator_profile";

export default function Profile({ user, onUserUpdate }) {
  /* =========================================================
     DEFAULT PROFILE
  ========================================================= */

  const defaultProfile = {
    name:
      user?.name ||
      user?.fullName ||
      "Operator",

    email:
      user?.email ||
      "operator@example.com",

    role:
      user?.role ||
      "Operator",

    operatorId:
      user?.operatorId ||
      user?.operator_id ||
      "OP-001",

    department:
      user?.department ||
      "Production",

    shift:
      user?.shift ||
      "Day Shift",

    profileImage:
      user?.profileImage ||
      user?.avatar ||
      "",
  };

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  const [profile, setProfile] = useState(() => {
    try {
      const stored =
        localStorage.getItem(PROFILE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);

        return {
          ...defaultProfile,
          ...parsed,
        };
      }
    } catch (error) {
      console.error(
        "Unable to load operator profile:",
        error
      );
    }

    return defaultProfile;
  });

  /* =========================================================
     EDIT STATE
  ========================================================= */

  const [editing, setEditing] =
    useState(false);

  const [editName, setEditName] =
    useState(profile.name || "");

  const [editImage, setEditImage] =
    useState(profile.profileImage || "");

  const [saved, setSaved] =
    useState(false);

  /* =========================================================
     KEEP PROFILE SYNCHRONIZED WITH USER
  ========================================================= */

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfile((current) => ({
      ...current,

      email:
        user.email ||
        current.email,

      role:
        user.role ||
        current.role,

      operatorId:
        user.operatorId ||
        user.operator_id ||
        current.operatorId,

      department:
        user.department ||
        current.department,

      shift:
        user.shift ||
        current.shift,

      /*
       * Do not overwrite a locally saved name
       * or profile image unnecessarily.
       */
      name:
        current.name ||
        user.name ||
        user.fullName ||
        "Operator",
    }));
  }, [user]);

  /* =========================================================
     START EDITING
  ========================================================= */

  const handleEdit = () => {
    setEditName(
      profile.name || ""
    );

    setEditImage(
      profile.profileImage || ""
    );

    setSaved(false);

    setEditing(true);
  };

  /* =========================================================
     CANCEL EDIT
  ========================================================= */

  const handleCancel = () => {
    setEditName(
      profile.name || ""
    );

    setEditImage(
      profile.profileImage || ""
    );

    setEditing(false);
    setSaved(false);
  };

  /* =========================================================
     PROFILE IMAGE
  ========================================================= */

  const handleImageChange = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    /*
     * Limit profile image size.
     */
    if (file.size > 5 * 1024 * 1024) {
      window.alert(
        "Please choose a profile image smaller than 5 MB."
      );

      event.target.value = "";

      return;
    }

    /*
     * Only allow image files.
     */
    if (!file.type.startsWith("image/")) {
      window.alert(
        "Please select a valid image file."
      );

      event.target.value = "";

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setEditImage(
        reader.result
      );
    };

    reader.onerror = () => {
      window.alert(
        "Unable to read the selected image."
      );
    };

    reader.readAsDataURL(file);
  };

  /* =========================================================
     REMOVE PROFILE IMAGE
  ========================================================= */

  const handleRemoveImage = () => {
    setEditImage("");
  };

  /* =========================================================
     SAVE PROFILE
  ========================================================= */

  const handleSave = () => {
    const trimmedName =
      editName.trim();

    if (!trimmedName) {
      window.alert(
        "Please enter your name."
      );

      return;
    }

    const updatedProfile = {
      ...profile,

      name: trimmedName,

      profileImage:
        editImage || "",
    };

    setProfile(
      updatedProfile
    );

    /*
     * Save profile locally.
     */
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(
          updatedProfile
        )
      );

      /*
       * Also update the application's
       * authenticated user.
       */
      const storedUser =
        localStorage.getItem(
          "phm_auth_user"
        );

      if (storedUser) {
        try {
          const currentUser =
            JSON.parse(
              storedUser
            );

          const updatedUser = {
            ...currentUser,

            name: trimmedName,

            profileImage:
              editImage || "",
          };

          localStorage.setItem(
            "phm_auth_user",
            JSON.stringify(
              updatedUser
            )
          );

          /*
           * Tell App.jsx about the
           * updated user if callback
           * was supplied.
           */
          if (onUserUpdate) {
            onUserUpdate(
              updatedUser
            );
          }
        } catch (error) {
          console.error(
            "Unable to update authenticated user:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Unable to save operator profile:",
        error
      );
    }

    setEditing(false);

    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  /* =========================================================
     INITIALS
  ========================================================= */

  const initials =
    (profile.name ||
      profile.email ||
      "OP")
      .split(/\s+/)
      .filter(Boolean)
      .map(
        (part) =>
          part[0]
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="profile-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="profile-page-header">

        <div>
          <div className="profile-kicker">
            Operator Account
          </div>

          <h1>
            My Profile
          </h1>

          <p>
            View and manage your operator
            information and account details.
          </p>
        </div>

        <div className="profile-header-actions">

          {!editing ? (
            <button
              type="button"
              className="profile-edit-button"
              onClick={handleEdit}
            >
              <i className="bi bi-pencil-square" />

              Edit Profile
            </button>
          ) : (
            <>
              <button
                type="button"
                className="profile-cancel-button"
                onClick={handleCancel}
              >
                Cancel
              </button>

              <button
                type="button"
                className="profile-save-button"
                onClick={handleSave}
              >
                <i className="bi bi-check-lg" />

                Save Changes
              </button>
            </>
          )}

        </div>

      </div>

      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {saved && (
        <div className="profile-success-message">

          <i className="bi bi-check-circle-fill" />

          Profile updated successfully.

        </div>
      )}

      {/* =====================================================
          PROFILE OVERVIEW
      ===================================================== */}

      <section className="profile-overview-card">

        {/* ---------------------------------------------------
            PROFILE AVATAR
        ---------------------------------------------------- */}

        <div className="profile-avatar-section">

          <div className="profile-avatar">

            {(
              editing
                ? editImage
                : profile.profileImage
            ) ? (
              <img
                src={
                  editing
                    ? editImage
                    : profile.profileImage
                }
                alt="Operator profile"
              />
            ) : (
              <span>
                {initials}
              </span>
            )}

          </div>

          {editing && (
            <div className="profile-avatar-actions">

              <label
                htmlFor="profile-image-upload"
                className="profile-photo-button"
              >
                <i className="bi bi-camera" />

                Change Photo
              </label>

              <input
                id="profile-image-upload"
                type="file"
                accept="image/*"
                onChange={
                  handleImageChange
                }
                hidden
              />

              {editImage && (
                <button
                  type="button"
                  className="profile-remove-photo"
                  onClick={
                    handleRemoveImage
                  }
                >
                  Remove
                </button>
              )}

            </div>
          )}

        </div>

        {/* ---------------------------------------------------
            PROFILE IDENTITY
        ---------------------------------------------------- */}

        <div className="profile-identity">

          <div className="profile-status">

            <span className="profile-status-dot" />

            Active Operator

          </div>

          <h2>
            {profile.name}
          </h2>

          <p>
            {profile.role}
          </p>

          <div className="profile-operator-id">

            <i className="bi bi-person-badge" />

            Operator ID:

            <strong>
              {profile.operatorId}
            </strong>

          </div>

        </div>

      </section>

      {/* =====================================================
          OPERATOR INFORMATION
      ===================================================== */}

      <section className="profile-section-card">

        <div className="profile-section-header">

          <div className="profile-section-icon">
            <i className="bi bi-person-vcard" />
          </div>

          <div>
            <h2>
              Operator Information
            </h2>

            <p>
              Your registered operator details.
            </p>
          </div>

        </div>

        {/* ===================================================
            EDITABLE NAME
        =================================================== */}

        {editing && (
          <div className="profile-edit-area">

            <div className="profile-field profile-field-full">

              <label htmlFor="operator-name">
                Full Name
              </label>

              <div className="profile-input-wrapper">

                <i className="bi bi-person" />

                <input
                  id="operator-name"
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(
                      event.target.value
                    )
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                />

              </div>

            </div>

          </div>
        )}

        {/* ===================================================
            INFORMATION GRID
        =================================================== */}

        <div className="profile-information-grid">

          <div className="profile-information-item">

            <span>
              Full Name
            </span>

            <strong>
              {editing
                ? editName || "Not provided"
                : profile.name}
            </strong>

          </div>

          <div className="profile-information-item">

            <span>
              Email Address
            </span>

            <strong>
              {profile.email}
            </strong>

          </div>

          <div className="profile-information-item">

            <span>
              Role
            </span>

            <strong>
              {profile.role}
            </strong>

          </div>

          <div className="profile-information-item">

            <span>
              Operator ID
            </span>

            <strong>
              {profile.operatorId}
            </strong>

          </div>

          <div className="profile-information-item">

            <span>
              Department
            </span>

            <strong>
              {profile.department}
            </strong>

          </div>

          <div className="profile-information-item">

            <span>
              Shift
            </span>

            <strong>
              {profile.shift}
            </strong>

          </div>

        </div>

      </section>

      {/* =====================================================
          SYSTEM ACCESS
      ===================================================== */}

      <section className="profile-section-card">

        <div className="profile-section-header">

          <div className="profile-section-icon security">
            <i className="bi bi-shield-check" />
          </div>

          <div>
            <h2>
              System Access
            </h2>

            <p>
              Your current ToolWear.AI permissions.
            </p>
          </div>

        </div>

        <div className="profile-access-list">

          <div className="profile-access-item">

            <div className="profile-access-icon">
              <i className="bi bi-cpu" />
            </div>

            <div>
              <strong>
                Machine Monitoring
              </strong>

              <span>
                View assigned CNC machines
                and machine status.
              </span>
            </div>

            <span className="profile-access-badge">
              Allowed
            </span>

          </div>

          <div className="profile-access-item">

            <div className="profile-access-icon">
              <i className="bi bi-activity" />
            </div>

            <div>
              <strong>
                Predictive Maintenance
              </strong>

              <span>
                View tool wear predictions
                and machine telemetry.
              </span>
            </div>

            <span className="profile-access-badge">
              Allowed
            </span>

          </div>

          <div className="profile-access-item">

            <div className="profile-access-icon">
              <i className="bi bi-stars" />
            </div>

            <div>
              <strong>
                Explainable AI
              </strong>

              <span>
                Review AI explanations and
                prediction confidence.
              </span>
            </div>

            <span className="profile-access-badge">
              Allowed
            </span>

          </div>

          <div className="profile-access-item">

            <div className="profile-access-icon">
              <i className="bi bi-graph-up-arrow" />
            </div>

            <div>
              <strong>
                Wear Progression
              </strong>

              <span>
                Review historical tool wear
                progression.
              </span>
            </div>

            <span className="profile-access-badge">
              Allowed
            </span>

          </div>

        </div>

      </section>

      {/* =====================================================
          ACCOUNT INFORMATION
      ===================================================== */}

      <section className="profile-account-note">

        <div className="profile-account-note-icon">
          <i className="bi bi-info-circle" />
        </div>

        <div>
          <strong>
            Operator account
          </strong>

          <p>
            Your email, role, operator ID,
            department and shift are managed
            by the system administrator.
            You can update your display name
            and profile picture here.
          </p>
        </div>

      </section>

    </div>
  );
}