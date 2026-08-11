import { forwardRef } from "react";
import { controlClass } from "./Input";

const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select ref={ref} className={controlClass(`cursor-pointer ${className ?? ""}`)} {...props} />
    );
  },
);

export default Select;
