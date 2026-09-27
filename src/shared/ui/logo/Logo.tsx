export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <img src="/favicon.svg" alt="" />
      <span>
        MAX<span className="logo-dot">.</span>
      </span>
    </div>
  );
}
