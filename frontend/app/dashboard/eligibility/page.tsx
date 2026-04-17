"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eligibilityApi } from "@/lib/api";
import { GovernmentScheme } from "@/lib/types";
import { 
  ChevronLeft, 
  Search, 
  Sparkles, 
  User, 
  IndianRupee, 
  Landmark, 
  MapPin,
  Users, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function EligibilityCheckPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GovernmentScheme[] | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    age: "",
    annual_income: "",
    land_size_acres: "",
    category: "General",
    state: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.age || !formData.annual_income || !formData.land_size_acres) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const res = await eligibilityApi.check({
        age: parseInt(formData.age),
        annual_income: parseFloat(formData.annual_income),
        land_size_acres: parseFloat(formData.land_size_acres),
        category: formData.category,
        state: formData.state || undefined
      });
      
      setResults(res.data.eligible_schemes);
      if (res.data.eligible_schemes.length === 0) {
        toast.info("No schemes matched your profile yet.");
      } else {
        toast.success(`Found ${res.data.eligible_schemes.length} eligible schemes!`);
      }
    } catch (error) {
      console.error("Eligibility check failed", error);
      toast.error("Failed to check eligibility. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setFormData({
      age: "",
      annual_income: "",
      land_size_acres: "",
      category: "General",
      state: ""
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-12 px-4 lg:px-8 shadow-md">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            className="text-white/80 hover:text-white hover:bg-white/10 mb-6"
            onClick={() => router.push("/dashboard/schemes")}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Schemes
          </Button>
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Eligibility Checker</h1>
              <p className="text-teal-50/90 text-lg">Find government support programs you qualify for in seconds.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8">
        {!results ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-50 p-8">
                <CardTitle className="text-2xl font-bold text-gray-800">Your Farmer Profile</CardTitle>
                <CardDescription>Enter your details to see matched state and central schemes.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="p-8 space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Age */}
                    <div className="space-y-3">
                      <Label htmlFor="age" className="text-base font-semibold text-gray-700 flex items-center">
                        <User className="w-4 h-4 mr-2 text-emerald-600" /> Age
                      </Label>
                      <Input 
                        id="age"
                        type="number"
                        placeholder="e.g. 35"
                        className="h-12 text-lg rounded-xl border-gray-200 focus:ring-emerald-500 shadow-sm"
                        value={formData.age}
                        onChange={(e) => setFormData({...formData, age: e.target.value})}
                        required
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-3">
                      <Label htmlFor="category" className="text-base font-semibold text-gray-700 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-emerald-600" /> Category
                      </Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(val: string) => setFormData({...formData, category: val})}
                      >
                        <SelectTrigger className="h-12 text-lg rounded-xl border-gray-200 shadow-sm">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="OBC">OBC</SelectItem>
                          <SelectItem value="SC">SC</SelectItem>
                          <SelectItem value="ST">ST</SelectItem>
                          <SelectItem value="Minority">Minority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Annual Income */}
                    <div className="space-y-3">
                      <Label htmlFor="income" className="text-base font-semibold text-gray-700 flex items-center">
                        <IndianRupee className="w-4 h-4 mr-2 text-emerald-600" /> Annual Income (₹)
                      </Label>
                      <Input 
                        id="income"
                        type="number"
                        placeholder="e.g. 150000"
                        className="h-12 text-lg rounded-xl border-gray-200 focus:ring-emerald-500 shadow-sm"
                        value={formData.annual_income}
                        onChange={(e) => setFormData({...formData, annual_income: e.target.value})}
                        required
                      />
                    </div>

                    {/* Land Size */}
                    <div className="space-y-3">
                      <Label htmlFor="land" className="text-base font-semibold text-gray-700 flex items-center">
                        <Landmark className="w-4 h-4 mr-2 text-emerald-600" /> Land Size (Acres)
                      </Label>
                      <Input 
                        id="land"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 2.5"
                        className="h-12 text-lg rounded-xl border-gray-200 focus:ring-emerald-500 shadow-sm"
                        value={formData.land_size_acres}
                        onChange={(e) => setFormData({...formData, land_size_acres: e.target.value})}
                        required
                      />
                    </div>

                    {/* State */}
                    <div className="space-y-3 md:col-span-2">
                      <Label htmlFor="state" className="text-base font-semibold text-gray-700 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-emerald-600" /> State
                      </Label>
                      <Input 
                        id="state"
                        placeholder="e.g. Maharashtra (Leave blank for central schemes only)"
                        className="h-12 text-lg rounded-xl border-gray-200 focus:ring-emerald-500 shadow-sm"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50/50 p-8 flex justify-center border-t border-gray-100">
                  <Button 
                    type="submit" 
                    size="lg" 
                    disabled={loading}
                    className="w-full md:w-auto px-12 py-7 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xl shadow-xl transition-all hover:scale-105 active:scale-95"
                  >
                    {loading ? (
                      <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Analyzing Eligibility...</>
                    ) : (
                      "Check Qualified Schemes"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            {/* Header for Results */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900">Matches Found</h2>
                <p className="text-gray-500 mt-1">Based on your profile, you may qualify for the following {results.length} schemes.</p>
              </div>
              <Button variant="outline" className="rounded-xl border-gray-300 font-bold" onClick={handleReset}>
                New Search
              </Button>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((scheme, index) => (
                  <motion.div
                    key={scheme.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full flex flex-col border-none shadow-lg hover:shadow-2xl transition-all duration-300 rounded-3xl overflow-hidden bg-white">
                      <div className="bg-emerald-100/50 px-6 py-3 flex items-center justify-between">
                        <span className="text-emerald-700 font-bold text-sm tracking-wider uppercase">{scheme.category} Govt</span>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <CardHeader className="p-6">
                        <CardTitle className="text-xl font-bold text-gray-800 line-clamp-2 leading-tight">
                          {scheme.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 pb-6 flex-1">
                        <p className="text-gray-600 text-sm line-clamp-3 mb-6 leading-relaxed">
                          {scheme.description}
                        </p>
                        <div className="space-y-3 bg-gray-50 p-4 rounded-2xl">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Age:</span>
                            <span className="font-semibold text-gray-800">{scheme.min_age ? `${scheme.min_age}+` : "Any"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Income Limit:</span>
                            <span className="font-semibold text-emerald-700">₹{scheme.max_income?.toLocaleString() || "No Limit"}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-6 pt-0 mt-auto">
                        <Button 
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold py-6 group"
                          onClick={() => router.push(`/dashboard/schemes/${scheme.id}`)}
                        >
                          View & Apply <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-20 text-center rounded-[3rem] border-none shadow-xl bg-white">
                 <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                 </div>
                 <h3 className="text-3xl font-extrabold text-gray-900">No Matches Found</h3>
                 <p className="text-gray-500 mt-4 max-w-md mx-auto text-lg leading-relaxed">
                   Currently, there are no specific schemes in our database that match all your criteria. 
                   Try adjusting your filters or check back soon as we update daily.
                 </p>
                 <Button 
                    className="mt-10 px-10 py-6 rounded-2xl bg-emerald-600 font-bold text-lg" 
                    onClick={handleReset}
                 >
                    Adjust Profile
                 </Button>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
