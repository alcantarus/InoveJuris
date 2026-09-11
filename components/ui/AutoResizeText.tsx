import React, { useRef, useEffect } from 'react';

export const AutoResizeText = ({ text, className, containerRef }: { text: string, className?: string, containerRef: React.RefObject<HTMLDivElement | null> }) => {
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    let animationFrameId: number;

    const resize = () => {
      if (!container || !textElement) return;
      
      let fontSize = 48; // Start with a larger size
      textElement.style.fontSize = `${fontSize}px`;
      textElement.style.whiteSpace = 'nowrap';

      // Use a smaller step for better precision
      while (textElement.scrollWidth > container.clientWidth - 32 && fontSize > 10) { // 32px for padding
        fontSize -= 1;
        textElement.style.fontSize = `${fontSize}px`;
      }
    };

    const handleResize = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(resize);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    handleResize();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [text, containerRef]);

  return <p ref={textRef} className={className}>{text}</p>;
};
