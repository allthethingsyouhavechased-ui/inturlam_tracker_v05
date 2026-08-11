import { forwardRef } from "react";
import { controlClass } from "./Input";

const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={controlClass(className)} {...props} />;
  },
);

export default Textarea;
