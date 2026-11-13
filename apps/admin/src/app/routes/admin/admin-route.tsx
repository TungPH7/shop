import { ProductCreateForm } from '@/features/product/components/product-create-form';

export function AdminRoute() {
  return (
    <section>
      <h2>Admin</h2>
      <p>Module-gated area — reachable only with the “role” module permission.</p>
      <h3>Create product</h3>
      <ProductCreateForm />
    </section>
  );
}
