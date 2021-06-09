import React from "react";

const Loader = ({ reason = "Loading ..." }) => {
  return (
    <>
      <div className="loader" />
      <p className="loader-text">{reason}</p>
    </>
  );
};

export default Loader;
