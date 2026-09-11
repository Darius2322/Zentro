import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { NewResourceTypeForm, AddResourceForm, ResourceStatusSelect } from "@/components/ResourceControls";

export default async function ResourcesPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const resourceTypes = await prisma.resourceType.findMany({
    where: { businessId: business.id },
    include: { resources: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Resources</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Chairs, tables, rooms, and equipment your services need.
          </p>
        </div>
        <NewResourceTypeForm slug={params.slug} />
      </div>

      {resourceTypes.length === 0 ? (
        <div className="list"><div className="empty-state">No resources configured.</div></div>
      ) : (
        resourceTypes.map((rt) => (
          <div key={rt.id} style={{ marginBottom: 24 }}>
            <h2>{rt.name}</h2>
            <div className="list">
              {rt.resources.length === 0 ? (
                <div className="empty-state">No {rt.name.toLowerCase()}s added yet.</div>
              ) : (
                rt.resources.map((r) => (
                  <div className="list-row" key={r.id}>
                    <div className="list-row-main list-row-title">{r.name}</div>
                    <ResourceStatusSelect slug={params.slug} resourceId={r.id} status={r.status} />
                  </div>
                ))
              )}
            </div>
            <AddResourceForm slug={params.slug} resourceTypeId={rt.id} />
          </div>
        ))
      )}
    </div>
  );
}
