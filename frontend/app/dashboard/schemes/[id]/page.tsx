"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { schemesApi } from "@/lib/api";
import { GovernmentScheme } from "@/lib/types";
import { ChevronLeft, ExternalLink } from "lucide-react";

export default function SchemeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schemeId = Number(params?.id);
  const [scheme, setScheme] = useState<GovernmentScheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schemeId) {
      setError("Invalid scheme ID.");
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await schemesApi.getById(schemeId);
        setScheme(res.data);
      } catch (err) {
        setError("Scheme not found.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schemeId]);

  const handleApply = async () => {
    if (!scheme) return;
    try {
      await schemesApi.apply(scheme.id);
      if (scheme.application_link) {
        window.open(scheme.application_link, "_blank");
      }
      alert("Application submitted, opening the official link.");
    } catch (err) {
      alert("Failed to submit application.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading scheme...</div>;
  if (error || !scheme) return <div className="p-6 text-center text-red-600">{error || "Scheme not found."}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => router.push("/dashboard/schemes")}> 
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Schemes
        </Button>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{scheme.title}</CardTitle>
            <p className="text-sm text-gray-500">{scheme.eligibility || "Eligibility not provided"}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-700">{scheme.description}</p>
            {scheme.deadline && <p className="text-sm font-medium text-krishi-dark">Deadline: {new Date(scheme.deadline).toDateString()}</p>}
            {scheme.application_link && (
              <Button onClick={() => window.open(scheme.application_link, "_blank")}>
                Open official page <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
            <div className="pt-3">
              <Button onClick={handleApply}>Apply Now</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
