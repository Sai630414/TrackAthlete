import React from 'react';

export function RadioGroup({ value, onChange, name, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          name,
          checked: child.props.value === value,
          onChange: () => onChange(child.props.value),
        });
      })}
    </div>
  );
}

export function RadioGroupItem({ value, label, checked, onChange, name, id }) {
  const itemKey = id || `radio-${value}-${Math.random().toString(36).substring(2, 6)}`;
  return (
    <label htmlFor={itemKey} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-300 select-none">
      <input
        type="radio"
        id={itemKey}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 focus:ring-blue-500 cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}
