export function createEmptyCompanyForm() {
  return {
    companyName: "",
    website: "",
    location: "",
    description: "",
  };
}

export function validateCompanyForm(formData) {
  if (!formData.companyName.trim()) {
    return "Company name is required.";
  }

  if (
    formData.website.trim() &&
    !/^https?:\/\/\S+\.\S+$/i.test(formData.website.trim())
  ) {
    return "Website must be a valid URL starting with http:// or https://.";
  }

  return "";
}
