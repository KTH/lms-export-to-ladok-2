import React from "react";

const Loader = ({ reason = "Loading ..." }) => (
  <>
    <div className="loader" />
    <p className="loader-text">{reason}</p>
  </>
);

export default Loader;
