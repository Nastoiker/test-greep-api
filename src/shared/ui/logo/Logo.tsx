export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <img src="/favicon.svg" alt="" />
      <span>MAX / чат</span>
    </div>
  );
}
