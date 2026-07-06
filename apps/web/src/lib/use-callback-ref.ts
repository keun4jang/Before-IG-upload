'use client';

import { useCallback, useRef } from 'react';

/**
 * 최신 클로저를 참조하는 안정적인 콜백을 반환합니다.
 * onBlur/onChange 핸들러에서 안전하게 async 저장을 호출하기 위한 헬퍼.
 */
export function useCallbackRef<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
): (...args: Args) => void {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Args) => {
    try {
      const r = ref.current(...args);
      if (r instanceof Promise) r.catch((e) => console.error(e));
    } catch (e) {
      console.error(e);
    }
  }, []);
}
